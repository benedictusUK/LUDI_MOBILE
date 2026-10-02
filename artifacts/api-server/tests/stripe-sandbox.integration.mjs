// Explicitly invoked real-Stripe integration checks. Never runs under node --test.
// All money is simulated in Stripe's sandbox; fixtures are development-only.
import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run sandbox fixtures in production");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  stdin: { contents: `
    export * from '@workspace/db';
    export { db as apiDb, pool as apiPool } from './src/db';
    export { stripe, platformFeeBasisPoints } from './src/payments/stripeClient';
    export * from './src/payments/policyService';
    export { registerEventPaymentPolicies } from './src/routes/eventPaymentPolicies';
    export { captureAuthorizedPayments } from './src/routes/payments';
    export { stripeWebhookHandler } from './src/routes/stripeWebhook';
    export { storage } from './src/storage';
    export { eq, inArray, and } from 'drizzle-orm';
    export { default as express } from 'express';
  `, resolveDir: cwd },
  platform: "node", format: "cjs", bundle: true, write: false, logLevel: "silent",
  external: ["pino", "pino-pretty", "thread-stream"],
});
const compiled = new Module(`${cwd}/tests/stripe-sandbox-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
const x = compiled.exports;
const { apiDb: db, stripe, eq, and, inArray, users, teams, teamMemberships, events,
  eventPayments, payments, paymentRefunds, paymentOperations } = x;
const runId = `stripe-qa-${randomUUID()}`;
const ids = [0, 1, 2, 3].map(n => `${runId}-${n}`);
const [ownerId, memberId, secondId, otherId] = ids;
const teamId = runId;
const eventIds = [], intentIds = new Set(), customerIds = new Set();
const results = [];
let account, server, base, fixturesInserted = false;
const reportPath = new URL("../../../.local/stripe-sandbox-results.json", import.meta.url);
const safeError = e => ({
  type: e.type || e.name, code: e.code, param: e.param,
  // Redact credentials and intent client secrets even in provider errors.
  message: String(e.message || "").replace(/\b(?:sk|pk|rk)_[^\s"'<>]+/g, "[redacted]")
    .replace(/\b(?:pi|seti)_[^\s"'<>]*_secret_[^\s"'<>]+/g, "[redacted]"),
});
async function checkpoint(name, run) {
  console.log("CHECK", name);
  try {
    await run();
    results.push({ name, status: "passed" });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, status: "failed", error: safeError(error) });
    console.error("FAIL", name, safeError(error));
    throw error;
  }
}
async function request(method, path, body, userId = memberId) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", "X-Test-User": userId },
    signal: AbortSignal.timeout(30000),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function makeEvent(policy, extra = {}) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const result = await request("POST", "/api/events", {
    name: "LUDI Stripe sandbox QA — no real money", sport: "Football",
    startDate: tomorrow, startTime: "16:00", endTime: "18:00",
    location: "Sandbox only", requirements: "Isolated automated Stripe sandbox fixture",
    primaryTeamId: teamId, paymentRequired: true, paymentPolicy: policy, currency: "gbp",
    ...(policy.startsWith("fixed") ? { fixedPriceMinor: 1500 } : { maxPlayerPayment: "20.00" }),
    ...(policy === "fixed_threshold" ? { minimumPaidParticipants: 2 } : {}),
    paymentDeadlineAt: new Date(Date.now() + 600000).toISOString(),
    ...extra,
  }, ownerId);
  assert.equal(result.status, 200, result.data.message || "Event creation failed");
  return result.data;
}
async function newIntent(event, userId = memberId) {
  const result = await request("POST", "/api/payments/create-intent", { eventId: event.id }, userId);
  assert.equal(result.status, 200, result.data.message || "Intent creation failed");
  intentIds.add(result.data.paymentIntentId);
  const pi = await stripe.paymentIntents.retrieve(result.data.paymentIntentId);
  customerIds.add(typeof pi.customer === "string" ? pi.customer : pi.customer.id);
  assert.equal(pi.livemode, false);
  return pi;
}
async function card(pi, token = "tok_visa") {
  if (token.startsWith("pm_")) return stripe.paymentMethods.attach(token, { customer: typeof pi.customer === "string" ? pi.customer : pi.customer.id });
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token } });
  await stripe.paymentMethods.attach(pm.id, { customer: typeof pi.customer === "string" ? pi.customer : pi.customer.id });
  return pm;
}
async function pay(event, userId = memberId, token = "tok_visa") {
  const pi = await newIntent(event, userId);
  const pm = await card(pi, token);
  const response = await request("POST", `/api/events/${event.id}/authorize-payment`, {
    paymentMethodId: pm.id, amount: 1, currency: "usd",
  }, userId);
  return { pi, pm, response };
}
async function paymentRow(event, userId = memberId) {
  const [row] = await db.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.userId, userId)));
  return row;
}
async function checkTransfer(piId, expectedAmount) {
  const pi = await stripe.paymentIntents.retrieve(piId);
  const ch = await stripe.charges.retrieve(pi.latest_charge);
  // Charge.amount retains the original authorization after partial capture.
  // Verify the captured money, not the authorization ceiling.
  assert.equal(pi.amount_received, expectedAmount);
  assert.equal(ch.amount_captured, expectedAmount);
  assert.equal(ch.captured, true);
  const tr = await stripe.transfers.retrieve(typeof ch.transfer === "string" ? ch.transfer : ch.transfer.id);
  const fee = Math.round(expectedAmount * x.platformFeeBasisPoints / 10000);
  assert.equal(typeof tr.destination === "string" ? tr.destination : tr.destination.id, account.id);
  // Stripe creates the gross destination transfer and debits the application fee.
  assert.equal(tr.amount, expectedAmount);
  const appFee = await stripe.applicationFees.retrieve(typeof ch.application_fee === "string" ? ch.application_fee : ch.application_fee.id);
  assert.equal(appFee.amount, fee);
  return { ch, tr, appFee };
}
async function refundAndVerify(event, piId) {
  await x.refundRegistration(event, memberId, "sandbox_cleanup");
  const { ch, tr, appFee } = await checkTransfer(piId, (await stripe.paymentIntents.retrieve(piId)).amount_received);
  assert.equal(ch.refunded, true);
  assert.equal(tr.amount_reversed, tr.amount);
  assert.equal(appFee.refunded, true);
}

try {
  await checkpoint("Provider is sandbox, not live", async () => {
    assert.equal((await stripe.balance.retrieve()).livemode, false);
  });
  await checkpoint("Isolated UK organizer can receive sandbox charges", async () => {
    account = await stripe.accounts.create({
      type: "custom", country: "GB", business_type: "individual",
      metadata: { ludiSandboxQA: runId },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { mcc: "7999", url: "https://accessible.stripe.com", product_description: "Sandbox sports events only" },
      individual: { first_name: "LUDI", last_name: "Sandbox", email: `${runId}@example.invalid`,
        phone: "0000000000", dob: { day: 1, month: 1, year: 1902 },
        address: { line1: "address_full_match", city: "London", postal_code: "SW1A 1AA", country: "GB" },
        verification: { document: { front: "file_identity_document_success" } },
      },
      external_account: { object: "bank_account", country: "GB", currency: "gbp", routing_number: "108800", account_number: "00012345" },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
    }, { idempotencyKey: runId });
    for (let n = 0; n < 60 && (!account.charges_enabled || !account.payouts_enabled); n++) {
      await sleep(1000);
      account = await stripe.accounts.retrieve(account.id);
      if (account.requirements.currently_due.length && !account.requirements.pending_verification.length) break;
    }
    console.log("Organizer capability status", JSON.stringify({
      chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled,
      capabilities: account.capabilities, requirements: {
        disabledReason: account.requirements.disabled_reason,
        currentlyDue: account.requirements.currently_due,
        pendingVerification: account.requirements.pending_verification,
        errors: account.requirements.errors,
      },
    }));
    assert.equal(account.charges_enabled, true, `Charges disabled; required fields: ${account.requirements.currently_due.join(", ")}`);
    assert.equal(account.payouts_enabled, true, `Payouts disabled; required fields: ${account.requirements.currently_due.join(", ")}`);
  });
  await db.insert(users).values(ids.map(id => ({ id, email: `${id}@example.invalid`,
    ...(id === ownerId ? { stripeAccountId: account.id, payoutsEnabled: account.payouts_enabled } : {}) })));
  fixturesInserted = true;
  await db.insert(teams).values({ id: teamId, name: "LUDI isolated Stripe sandbox QA", sports: ["Football"], ownerId });
  await db.insert(teamMemberships).values(ids.map(userId => ({ teamId, userId, role: userId === ownerId ? "admin" : "member" })));
  const app = x.express();
  app.post("/api/stripe/webhook", x.express.raw({ type: "application/json" }), x.stripeWebhookHandler);
  app.use(x.express.json());
  x.registerEventPaymentPolicies(app, (req, res, next) => {
    req.userId = req.header("X-Test-User");
    if (!ids.includes(req.userId)) return res.status(401).json({ message: "Unauthorized fixture identity" });
    next();
  });
  app.post("/api/events", async (req, res) => {
    try {
      const [event] = await db.insert(events).values(req.body).returning();
      eventIds.push(event.id);
      res.json(event);
    } catch { res.status(500).json({ message: "Fixture event could not be created" }); }
  });
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;

  await checkpoint("Fixed immediate: £15 real sandbox charge, authoritative GBP price, fees and retry protection", async () => {
    const event = await makeEvent("fixed_immediate");
    const { pi, pm, response } = await pay(event);
    assert.equal(response.status, 200, response.data.message);
    assert.equal(response.data.success, true);
    assert.equal((await stripe.paymentIntents.retrieve(pi.id)).amount_received, 1500);
    assert.equal((await newIntent(event)).id, pi.id);
    const retry = await request("POST", `/api/events/${event.id}/authorize-payment`, { paymentMethodId: pm.id });
    assert.equal(retry.status, 200);
    assert.equal((await paymentRow(event)).capturedAmountMinor, 1500);
    assert.equal(await x.hasValidEventPayment(event, memberId), true);
    await checkTransfer(pi.id, 1500);
    await refundAndVerify(event, pi.id);
    assert.equal(await x.hasValidEventPayment(event, memberId), false);
  });
  await checkpoint("Declined card cannot confirm attendance", async () => {
    const event = await makeEvent("fixed_immediate");
    const { pi, response } = await pay(event, memberId, "pm_card_chargeCustomerFail");
    assert.equal(response.status, 402);
    assert.equal((await stripe.paymentIntents.retrieve(pi.id)).amount_received, 0);
    assert.equal(await x.hasValidEventPayment(event, memberId), false);
    assert.equal(await x.storage.getUserAttendance(memberId, event.id), undefined);
  });
  await checkpoint("Foreign customer's card is rejected before charging", async () => {
    const event = await makeEvent("fixed_immediate");
    const pi = await newIntent(event, otherId);
    const pm = await card(pi);
    const own = await newIntent(event);
    const result = await request("POST", `/api/events/${event.id}/authorize-payment`, { paymentMethodId: pm.id });
    assert.equal(result.status, 403);
    assert.equal((await stripe.paymentIntents.retrieve(own.id)).amount_received, 0);
  });
  await checkpoint("3DS card requests authentication without confirming attendance", async () => {
    const event = await makeEvent("fixed_immediate");
    const { response, pi } = await pay(event, memberId, "tok_threeDSecure2Required");
    assert.equal(response.status, 409, response.data.message);
    assert.equal(response.data.requiresAction, true);
    assert.equal((await stripe.paymentIntents.retrieve(pi.id)).status, "requires_action");
    assert.equal(await x.hasValidEventPayment(event, memberId), false);
    assert.equal(await x.storage.getUserAttendance(memberId, event.id), undefined);
  });
  await checkpoint("Threshold missed: actual refund reverses destination transfer and fee once", async () => {
    const event = await makeEvent("fixed_threshold");
    const { pi, response } = await pay(event);
    assert.equal(response.status, 200, response.data.message);
    await sleep(1100);
    const deadline = new Date(Date.now() - 100);
    await db.update(events).set({ paymentDeadlineAt: deadline }).where(eq(events.id, event.id));
    event.paymentDeadlineAt = deadline;
    await x.reconcileThresholdEvent(event);
    await x.reconcileThresholdEvent(event);
    const receipts = await stripe.refunds.list({ payment_intent: pi.id });
    assert.equal(receipts.data.length, 1);
    assert.equal(receipts.data[0].status, "succeeded");
    assert.equal(receipts.data[0].amount, 1500);
    const { ch, tr, appFee } = await checkTransfer(pi.id, 1500);
    assert.equal(ch.refunded, true);
    assert.equal(tr.amount_reversed, 1500);
    assert.equal(appFee.refunded, true);
    assert.equal((await paymentRow(event)).refundedAmountMinor, 1500);
  });
  await checkpoint("Threshold met: payments retained after deadline", async () => {
    const event = await makeEvent("fixed_threshold");
    const a = await pay(event);
    const b = await pay(event, secondId);
    assert.equal(a.response.status, 200, a.response.data.message);
    assert.equal(b.response.status, 200, b.response.data.message);
    await sleep(1100);
    const deadline = new Date(Date.now() - 100);
    await db.update(events).set({ paymentDeadlineAt: deadline }).where(eq(events.id, event.id));
    event.paymentDeadlineAt = deadline;
    await x.reconcileThresholdEvent(event);
    assert.equal((await x.getPolicyQuote(event, ownerId)).paidParticipants, 2);
    assert.equal((await stripe.refunds.list({ payment_intent: a.pi.id })).data.length, 0);
    assert.equal((await stripe.refunds.list({ payment_intent: b.pi.id })).data.length, 0);
  });
  await checkpoint("Flexible: real £20 hold, capture £12, release unused £8 and collect correct fee", async () => {
    const event = await makeEvent("flexible_post_event");
    const { pi, response } = await pay(event);
    assert.equal(response.status, 200, response.data.message);
    const held = await stripe.paymentIntents.retrieve(pi.id);
    assert.equal(held.status, "requires_capture");
    assert.equal(held.amount_capturable, 2000);
    assert.equal(held.amount_received, 0);
    const charge = await stripe.charges.retrieve(held.latest_charge);
    assert.ok(charge.payment_method_details.card.capture_before);
    const legacy = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, pi.id));
    const result = await x.captureAuthorizedPayments(event.id, legacy, new Map([[legacy[0].id, 1200]]), account.id, ownerId);
    assert.equal(result.failedCaptures, 0);
    assert.equal(result.totalCaptured, 12);
    const captured = await stripe.paymentIntents.retrieve(pi.id);
    assert.equal(captured.status, "succeeded");
    assert.equal(captured.amount_received, 1200);
    assert.equal(captured.amount_capturable, 0);
    assert.equal((await paymentRow(event)).capturedAmountMinor, 1200);
    await checkTransfer(pi.id, 1200);
  });
  await checkpoint("Flexible withdrawal cancels the real hold without taking money", async () => {
    const event = await makeEvent("flexible_post_event");
    const { pi, response } = await pay(event);
    assert.equal(response.status, 200, response.data.message);
    const cancel = await request("POST", `/api/events/${event.id}/cancel-payment`, {});
    assert.equal(cancel.status, 200, cancel.data.message);
    const released = await stripe.paymentIntents.retrieve(pi.id);
    assert.equal(released.status, "canceled");
    assert.equal(released.amount_received, 0);
    assert.equal(released.amount_capturable, 0);
  });
} catch (error) {
  console.error("Sandbox run stopped safely", safeError(error));
  process.exitCode = 1;
} finally {
  // Refund every test charge and release every remaining hold, even on failure.
  const cleanupErrors = [];
  for (const id of intentIds) {
    try {
      const pi = await stripe.paymentIntents.retrieve(id);
      assert.equal(pi.livemode, false);
      if (pi.status === "succeeded") {
        const ch = await stripe.charges.retrieve(pi.latest_charge);
        if (ch.amount_refunded < pi.amount_received) {
          await stripe.refunds.create({ payment_intent: id, reverse_transfer: true,
            refund_application_fee: true, amount: pi.amount_received - ch.amount_refunded },
          { idempotencyKey: `${runId}:cleanup:${id}` });
        }
      } else if (!["canceled", "processing"].includes(pi.status)) await stripe.paymentIntents.cancel(id);
      else if (pi.status === "processing") throw new Error("Test intent still processing; retain for reconciliation");
    } catch (error) { cleanupErrors.push({ object: id, error: safeError(error) }); }
  }
  if (server) await new Promise(resolve => server.close(resolve));
  if (!cleanupErrors.length && fixturesInserted) {
    try {
      if (eventIds.length) {
        const rows = await db.select().from(eventPayments).where(inArray(eventPayments.eventId, eventIds));
        if (rows.length) {
          await db.delete(paymentRefunds).where(inArray(paymentRefunds.eventPaymentId, rows.map(r => r.id)));
          await db.delete(paymentOperations).where(inArray(paymentOperations.eventPaymentId, rows.map(r => r.id)));
        }
        await db.delete(events).where(inArray(events.id, eventIds));
      }
      await db.delete(x.notifications).where(inArray(x.notifications.userId, ids));
      await db.delete(teams).where(eq(teams.id, teamId));
      await db.delete(users).where(inArray(users.id, ids));
    } catch (error) { cleanupErrors.push({ object: "development fixtures", error: safeError(error) }); }
  }
  for (const id of customerIds) {
    try { await stripe.customers.del(id); } catch (error) { cleanupErrors.push({ object: id, error: safeError(error) }); }
  }
  if (account && !cleanupErrors.length) {
    try { await stripe.accounts.del(account.id); } catch (error) { cleanupErrors.push({ object: account.id, error: safeError(error) }); }
  }
  await Promise.all([x.apiPool.end(), x.pool.end()]);
  await mkdir(new URL("../", reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ runId, completedAt: new Date().toISOString(), sandbox: true,
    results, cleanupErrors, stripeIntents: [...intentIds], connectedAccount: account?.id,
    note: "No live payments. Provider receipts retained in Stripe; development fixtures removed if cleanup succeeded." }, null, 2));
  console.log("Cleanup", cleanupErrors.length ? cleanupErrors : "complete: test charges refunded, holds released, fixtures removed");
  if (cleanupErrors.length) process.exitCode = 1;
}