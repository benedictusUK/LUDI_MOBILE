import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import express from "express";
import Stripe from "stripe";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

// Run explicitly against development: no Stripe API calls, and all SQL writes
// are confined to temporary tables in a transaction that is always rolled back.
// The real handler, signature verifier, SQL predicates, and unique constraints
// are exercised; only Stripe charge/balance lookups and logging are stubbed.
test("Stripe webhook signatures, status updates, and accounting retries", {
  skip: !process.env.DATABASE_URL ? "Development DATABASE_URL required" : false,
}, async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production", "Never run against production");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const database = drizzle(pool);
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const testSecret = "whsec_isolated_webhook_regression_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = testSecret;
  const stripe = new Stripe("sk_test_isolated_fixture");
  const providerObjects = new Map();
  // The webhook intentionally fetches current provider objects rather than
  // trusting an older delivery snapshot. Keep these tests entirely isolated.
  stripe.paymentIntents.retrieve = async id => providerObjects.get(id);
  stripe.refunds.retrieve = async id => providerObjects.get(id);
  stripe.disputes.retrieve = async id => providerObjects.get(id);
  stripe.transfers.retrieve = async () => ({ id: "tr_fixture", amount: 950, currency: "gbp", destination: "acct_fixture" });
  let lookupFails = false;
  stripe.charges.retrieve = async () => {
    if (lookupFails) throw new Error("Fixture lookup failed");
    return {
      id: "ch_fixture",
      balance_transaction: "txn_fixture",
      transfer: "tr_fixture",
      payment_method_details: { card: { capture_before: 2_000_000_000 } },
    };
  };
  stripe.balanceTransactions.retrieve = async () => ({ fee: 59 });
  const contextKey = `__stripeWebhookTest_${Date.now()}`;
  globalThis[contextKey] = { stripe };
  let server;
  const rollback = new Error("Roll back isolated webhook fixtures");
  try {
    const compiled = await build({
      entryPoints: [new URL("./stripeWebhook.ts", import.meta.url).pathname],
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      plugins: [{
        name: "isolated-webhook-dependencies",
        setup(builder) {
          // Import only schema declarations, never the package's database pool.
          builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({
            path: new URL("../../../../lib/db/src/schema/index.ts", import.meta.url).pathname,
          }));
          builder.onResolve({ filter: /^\.\.\/(db|lib\/logger|payments\/stripeClient)$/ },
            ({ path }) => ({ path, namespace: "webhook-fixture" }));
          builder.onLoad({ filter: /.*/, namespace: "webhook-fixture" }, ({ path }) => ({
            contents: path.endsWith("/db")
              ? `export const db = globalThis[${JSON.stringify(contextKey)}].db;`
              : path.endsWith("/stripeClient")
                ? `export const stripe = globalThis[${JSON.stringify(contextKey)}].stripe;`
                : "export const logger = {warn() {}, error(details) { console.error('Webhook fixture failure:', details?.errName || 'unknown'); }};",
          }));
        },
      }],
    });
    await database.transaction(async (tx) => {
      // LIKE copies real columns, defaults, indexes and uniqueness constraints,
      // but not foreign keys. Shadow every table the handler can write.
      const tables = [
        "stripe_webhook_events", "payments", "event_payments", "users",
        "payment_transfers", "payment_refunds", "payment_disputes",
      ];
      for (const table of tables) {
        await tx.execute(sql.raw(
          `CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING ALL) ON COMMIT DROP`,
        ));
      }
      await tx.execute(sql`SET LOCAL search_path = pg_temp, public`);
      for (const table of tables) {
        const result = await tx.execute(sql`
          SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = to_regclass(${table})
        `);
        assert.match(result.rows[0].nspname, /^pg_temp_/);
      }
      globalThis[contextKey].db = tx;
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`;
      const { stripeWebhookHandler } = await import(moduleUrl);
      const app = express();
      app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
      app.use(express.json());
      server = await new Promise((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      });
      const url = `http://127.0.0.1:${server.address().port}/api/stripe/webhook`;
      const send = async (event, options = {}) => {
        providerObjects.set(event.data.object.id, structuredClone(event.data.object));
        const payload = JSON.stringify(event, null, 2);
        const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: testSecret });
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Stripe-Signature": options.signature ?? signature },
          body: options.tamper ? `${payload} ` : payload,
        });
        return { status: response.status, body: await response.json() };
      };
      const event = (id, type, object) => ({
        id, object: "event", type, livemode: false, api_version: "2025-07-30.basil",
        created: Math.floor(Date.now() / 1000), data: { object },
      });
      await tx.execute(sql`
        INSERT INTO payments (id, user_id, amount, type, stripe_payment_intent_id)
        VALUES ('payment_fixture', 'user_fixture', 10, 'event_fee', 'pi_fixture')
      `);
      await tx.execute(sql`
        INSERT INTO event_payments (id, event_id, user_id, payment_intent_id, setup_intent_id)
        VALUES ('ep_fixture', 'event_fixture', 'user_fixture', 'pi_fixture', 'seti_fixture')
      `);
      const intent = (status) => ({
        id: "pi_fixture", object: "payment_intent", status, amount_capturable: 1000,
        amount_received: status === "succeeded" ? 1000 : 0, currency: "gbp",
        latest_charge: "ch_fixture", application_fee_amount: 50,
        transfer_data: { destination: "acct_fixture" },
      });
      await t.test("invalid and tampered signatures write no receipts", async () => {
        const fixture = event("evt_invalid", "payment_intent.succeeded", intent("succeeded"));
        assert.equal((await send(fixture, { signature: "t=1,v1=invalid" })).status, 400);
        assert.equal((await send(fixture, { tamper: true })).status, 400);
        assert.equal((await tx.execute(sql`SELECT count(*)::int AS n FROM stripe_webhook_events`)).rows[0].n, 0);
      });
      for (const [status, type, domain, eventStatus] of [
        ["requires_capture", "payment_intent.amount_capturable_updated", "authorized", "hold_created"],
        ["canceled", "payment_intent.canceled", "cancelled", "cancelled"],
        ["requires_payment_method", "payment_intent.payment_failed", "failed", null],
        ["succeeded", "payment_intent.succeeded", "paid", "captured"],
      ]) {
        await t.test(`signed ${type} updates matching payment statuses`, async () => {
          const fixture = event(`evt_${status}`, type, intent(status));
          assert.equal((await send(fixture)).status, 200);
          assert.equal((await tx.execute(sql`SELECT status FROM payments`)).rows[0].status, domain);
          const row = (await tx.execute(sql`SELECT * FROM event_payments`)).rows[0];
          assert.equal(row.payment_intent_status, status);
          if (eventStatus) assert.equal(row.status, eventStatus);
          assert.equal(row.captured_amount_minor, status === "succeeded" ? 1000 : 0);
          assert.deepEqual((await send(fixture)).body, { received: true, duplicate: true });
        });
      }
      await t.test("distinct success events never duplicate a transfer", async () => {
        assert.equal((await send(event("evt_success_again", "payment_intent.succeeded", intent("succeeded")))).status, 200);
        const rows = (await tx.execute(sql`SELECT amount_minor FROM payment_transfers`)).rows;
        assert.deepEqual(rows, [{ amount_minor: 950 }]);
      });
      await t.test("refund retries upsert one accounting record", async () => {
        const refund = { id: "re_fixture", payment_intent: "pi_fixture", amount: 200, currency: "gbp", status: "pending" };
        const fixture = event("evt_refund", "refund.created", refund);
        assert.equal((await send(fixture)).status, 200);
        assert.equal((await send(fixture)).body.duplicate, true);
        assert.equal((await send(event("evt_refund_updated", "refund.updated", { ...refund, status: "succeeded" }))).status, 200);
        assert.deepEqual((await tx.execute(sql`SELECT amount_minor, status FROM payment_refunds`)).rows,
          [{ amount_minor: 200, status: "succeeded" }]);
      });
      await t.test("dispute updates and retries keep one accounting record", async () => {
        for (const [type, status] of [
          ["charge.dispute.created", "needs_response"],
          ["charge.dispute.updated", "under_review"],
          ["charge.dispute.closed", "won"],
        ]) {
          const fixture = event(`evt_${type}`, type, {
            id: "dp_fixture", charge: "ch_fixture", amount: 1000, currency: "gbp",
            status, reason: "fraudulent", evidence_details: { due_by: 2_000_000_000 },
          });
          assert.equal((await send(fixture)).status, 200);
          assert.equal((await send(fixture)).body.duplicate, true);
        }
        assert.deepEqual((await tx.execute(sql`SELECT status, amount_minor FROM payment_disputes`)).rows,
          [{ status: "won", amount_minor: 1000 }]);
      });
      await t.test("account changes update only the associated host", async () => {
        await tx.execute(sql`
          INSERT INTO users (id, email, stripe_account_id)
          VALUES ('host_fixture', 'host@example.invalid', 'acct_fixture')
        `);
        for (const enabled of [true, false]) {
          assert.equal((await send(event(`evt_account_${enabled}`, "account.updated", {
            id: "acct_fixture", payouts_enabled: enabled, charges_enabled: enabled,
          }))).status, 200);
          assert.equal((await tx.execute(sql`SELECT payouts_enabled FROM users`)).rows[0].payouts_enabled, enabled);
        }
      });
      await t.test("setup events update the associated setup state", async () => {
        for (const [type, status, expected] of [
          ["setup_intent.succeeded", "succeeded", "setup_complete"],
          ["setup_intent.canceled", "canceled", "setup_pending"],
          ["setup_intent.setup_failed", "requires_payment_method", "setup_pending"],
        ]) {
          assert.equal((await send(event(`evt_${type}`, type, {
            id: "seti_fixture", status, payment_method: "pm_fixture",
          }))).status, 200);
          assert.equal((await tx.execute(sql`SELECT status FROM event_payments`)).rows[0].status, expected);
        }
      });
      await t.test("failed processing can be retried without duplicate accounting", async () => {
        const fixture = event("evt_retry", "payment_intent.succeeded", intent("succeeded"));
        lookupFails = true;
        assert.equal((await send(fixture)).status, 500);
        lookupFails = false;
        assert.equal((await send(fixture)).status, 200);
        assert.equal((await send(fixture)).body.duplicate, true);
        const receipt = (await tx.execute(sql`
          SELECT status, attempt_count FROM stripe_webhook_events WHERE stripe_event_id = 'evt_retry'
        `)).rows[0];
        assert.deepEqual(receipt, { status: "processed", attempt_count: 2 });
        assert.equal((await tx.execute(sql`SELECT count(*)::int AS n FROM payment_transfers`)).rows[0].n, 1);
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
    delete globalThis[contextKey];
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  }
});