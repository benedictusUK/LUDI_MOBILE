// Real provider checks independent of Connect. This is NOT full LUDI checkout.
import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  stdin: { contents: `export { stripe } from './src/payments/stripeClient';`, resolveDir: cwd },
  platform: "node", format: "cjs", bundle: true, write: false, logLevel: "silent",
});
const compiled = new Module(`${cwd}/tests/stripe-provider-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
const { stripe } = compiled.exports;
assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1");
const runId = `ludi-provider-qa-${randomUUID()}`;
const metadata = { ludiSandboxQA: runId, purpose: "provider_smoke_not_ludi_checkout" };
const intents = new Set(), results = [], cleanupErrors = [];
let customer;
const safeError = e => ({ type: e.type || e.name, code: e.code, param: e.param,
  message: String(e.message || "").replace(/\b(?:sk|pk|rk)_[^\s"'<>]+/g, "[redacted]")
    .replace(/\b(?:pi|seti)_[^\s"'<>]*_secret_[^\s"'<>]+/g, "[redacted]") });
async function check(name, fn) {
  try { await fn(); results.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (e) { results.push({ name, status: "failed", error: safeError(e) }); console.error("FAIL", name, safeError(e)); process.exitCode = 1; }
}
async function pm(token) {
  if (token.startsWith("pm_")) return stripe.paymentMethods.attach(token, { customer: customer.id });
  const method = await stripe.paymentMethods.create({ type: "card", card: { token } });
  return stripe.paymentMethods.attach(method.id, { customer: customer.id });
}
async function create(data = {}, key = randomUUID()) {
  const intent = await stripe.paymentIntents.create({
    amount: 1500, currency: "gbp", customer: customer.id,
    payment_method_types: ["card"], metadata, ...data,
  }, { idempotencyKey: `${runId}:${key}` });
  intents.add(intent.id);
  assert.equal(intent.livemode, false);
  return intent;
}
try {
  assert.equal((await stripe.balance.retrieve()).livemode, false, "Refusing live Stripe");
  customer = await stripe.customers.create({ name: "LUDI isolated sandbox QA", metadata });
  const visa = await pm("tok_visa");
  await check("Real £15 GBP charge, duplicate retry protection and real refund", async () => {
    const data = { payment_method: visa.id, confirm: true, off_session: true };
    const intent = await create(data, "fixed-charge");
    assert.equal(intent.status, "succeeded");
    assert.equal(intent.amount_received, 1500);
    const retry = await create(data, "fixed-charge");
    assert.equal(retry.id, intent.id);
    const refund = await stripe.refunds.create({ payment_intent: intent.id },
      { idempotencyKey: `${runId}:fixed-refund` });
    assert.equal(refund.status, "succeeded");
    assert.equal(refund.amount, 1500);
    const again = await stripe.refunds.create({ payment_intent: intent.id },
      { idempotencyKey: `${runId}:fixed-refund` });
    assert.equal(again.id, refund.id);
    assert.equal((await stripe.refunds.list({ payment_intent: intent.id })).data.length, 1);
  });
  await check("Declined card takes no money", async () => {
    const method = await pm("pm_card_chargeCustomerFail");
    const intent = await create();
    let error;
    try { await stripe.paymentIntents.confirm(intent.id, { payment_method: method.id, use_stripe_sdk: true }); }
    catch (e) { error = e; }
    assert.equal(error?.code, "card_declined");
    assert.equal((await stripe.paymentIntents.retrieve(intent.id)).amount_received, 0);
  });
  await check("Required 3DS produces an authentication action, not a successful charge", async () => {
    const method = await pm("tok_threeDSecure2Required");
    const intent = await create();
    try { await stripe.paymentIntents.confirm(intent.id, { payment_method: method.id, use_stripe_sdk: true }); }
    catch (e) { if (e.code !== "authentication_required") throw e; }
    const state = await stripe.paymentIntents.retrieve(intent.id);
    assert.equal(state.status, "requires_action");
    assert.equal(state.amount_received, 0);
    assert.ok(state.next_action);
  });
  await check("£20 real authorization captures only £12 and releases £8", async () => {
    const held = await create({ amount: 2000, capture_method: "manual", payment_method: visa.id, confirm: true });
    assert.equal(held.status, "requires_capture");
    assert.equal(held.amount_received, 0);
    assert.equal(held.amount_capturable, 2000);
    const charge = await stripe.charges.retrieve(held.latest_charge);
    assert.ok(charge.payment_method_details.card.capture_before);
    const captured = await stripe.paymentIntents.capture(held.id, { amount_to_capture: 1200 });
    assert.equal(captured.status, "succeeded");
    assert.equal(captured.amount_received, 1200);
    assert.equal(captured.amount_capturable, 0);
  });
  await check("Canceling a real hold releases all £20 without charging", async () => {
    const held = await create({ amount: 2000, capture_method: "manual", payment_method: visa.id, confirm: true });
    assert.equal(held.amount_capturable, 2000);
    const released = await stripe.paymentIntents.cancel(held.id);
    assert.equal(released.status, "canceled");
    assert.equal(released.amount_capturable, 0);
    assert.equal(released.amount_received, 0);
  });
} catch (e) { console.error("Provider checks stopped", safeError(e)); process.exitCode = 1; }
finally {
  for (const id of intents) {
    try {
      const intent = await stripe.paymentIntents.retrieve(id);
      assert.equal(intent.livemode, false);
      if (intent.status === "succeeded") {
        const charge = await stripe.charges.retrieve(intent.latest_charge);
        if (charge.amount_refunded < intent.amount_received) await stripe.refunds.create({
          payment_intent: id, amount: intent.amount_received - charge.amount_refunded,
        }, { idempotencyKey: `${runId}:cleanup:${id}` });
      } else if (!["canceled", "processing"].includes(intent.status)) await stripe.paymentIntents.cancel(id);
      else if (intent.status === "processing") throw new Error("Test intent still processing");
    } catch (e) { cleanupErrors.push({ object: id, error: safeError(e) }); }
  }
  if (customer && !cleanupErrors.length) {
    try { await stripe.customers.del(customer.id); } catch (e) { cleanupErrors.push({ object: customer.id, error: safeError(e) }); }
  }
  // Stripe-sent delivery remains a separate check. Events are not forged here.
  let pendingWebhookDeliveries;
  try {
    const recent = await stripe.events.list({ limit: 100 });
    const ours = recent.data.filter(e => e.data.object.metadata?.ludiSandboxQA === runId);
    pendingWebhookDeliveries = { events: ours.length, pending: ours.filter(e => e.pending_webhooks > 0).length };
  } catch (e) { pendingWebhookDeliveries = { inspectionError: safeError(e) }; }
  const report = { runId, completedAt: new Date().toISOString(), sandbox: true,
    scope: "Actual Stripe provider operations only. Connect-backed LUDI checkout remains blocked.",
    results, cleanupErrors, stripeIntents: [...intents], pendingWebhookDeliveries };
  const path = new URL("../../../.local/stripe-provider-results.json", import.meta.url);
  await mkdir(new URL("../", path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log("Cleanup", cleanupErrors.length ? cleanupErrors : "complete: all charges refunded, holds released and customer deleted");
  console.log("Stripe webhook delivery snapshot", pendingWebhookDeliveries);
  if (cleanupErrors.length) process.exitCode = 1;
}