import assert from "node:assert/strict";
import { test, after } from "node:test";
import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  stdin: { contents: `
    export * from '@workspace/db';
    export { db as apiDb, pool as apiPool } from './src/db';
    export { stripe } from './src/payments/stripeClient';
    export * from './src/payments/policyService';
    export { registerEventPaymentPolicies } from './src/routes/eventPaymentPolicies';
    export { storage } from './src/storage';
    export { eq, inArray } from 'drizzle-orm';
    export { default as express } from 'express';
  `, resolveDir: cwd },
  platform: "node", format: "cjs", bundle: true, write: false, logLevel: "silent",
});
const compiled = new Module(`${cwd}/tests/payment-policy-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
const x = compiled.exports;
const { apiDb: db, stripe, eq, inArray, events, eventPayments, users, teams, teamMemberships, payments, paymentRefunds, paymentOperations } = x;
assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run fixture tests in production");

// The live provider is checked read-only. All charging/refund calls below use
// a deterministic Stripe adapter; no real cards, accounts or money are used.
const balance = await stripe.balance.retrieve();
assert.equal(balance.livemode, false, "LUDI payment checks must use its Stripe sandbox");
const original = {
  create: stripe.paymentIntents.create, retrieve: stripe.paymentIntents.retrieve, confirm: stripe.paymentIntents.confirm,
  cancel: stripe.paymentIntents.cancel, charge: stripe.charges.retrieve, method: stripe.paymentMethods.retrieve,
  refund: stripe.refunds.create,
};
const intents = new Map(), charges = new Map(), refundCalls = [], createCalls = [], confirmCalls = [];
const ids = [0, 1, 2, 3, 4].map(() => `policy-qa-${randomUUID()}`);
const [organiserId, memberId, secondId, thirdId, outsiderId] = ids;
const teamId = `policy-qa-${randomUUID()}`;
const eventIds = [];
stripe.paymentIntents.create = async (data, options) => {
  createCalls.push({ data, options });
  const id = `pi_policy_${randomUUID()}`;
  const intent = { ...data, id, client_secret: `${id}_secret_test`, status: "requires_payment_method",
    amount_received: 0, amount_capturable: 0, latest_charge: null, livemode: false };
  intents.set(id, intent);
  return structuredClone(intent);
};
stripe.paymentIntents.retrieve = async id => structuredClone(intents.get(id));
stripe.paymentIntents.confirm = async (id, { payment_method, off_session, use_stripe_sdk }) => {
  assert.notEqual(off_session, true, "Interactive checkout must allow bank authentication");
  confirmCalls.push({ payment_method, off_session, use_stripe_sdk });
  const intent = intents.get(id);
  if (payment_method.includes("sca")) {
    intent.status = "requires_action";
    return structuredClone(intent);
  }
  intent.status = intent.capture_method === "manual" ? "requires_capture" : "succeeded";
  intent.amount_received = intent.capture_method === "manual" ? 0 : intent.amount;
  intent.amount_capturable = intent.capture_method === "manual" ? intent.amount : 0;
  const chargeId = `ch_policy_${randomUUID()}`;
  intent.latest_charge = chargeId;
  charges.set(chargeId, { id: chargeId, created: Math.floor(Date.now() / 1000) - 120,
    amount_refunded: 0, refunded: false, payment_method_details: { card: { capture_before: Math.floor(Date.now() / 1000) + 5 * 86400 } } });
  return structuredClone(intent);
};
stripe.paymentIntents.cancel = async id => {
  intents.get(id).status = "canceled";
  return structuredClone(intents.get(id));
};
stripe.charges.retrieve = async id => structuredClone(charges.get(id));
stripe.paymentMethods.retrieve = async id => ({ id, type: "card", customer: id.replace(/^pm_/, "cus_").replace(/_sca$/, "") });
stripe.refunds.create = async (data, options) => {
  refundCalls.push({ data, options });
  const charge = charges.get(intents.get(data.payment_intent).latest_charge);
  charge.amount_refunded += data.amount;
  charge.refunded = true;
  return { id: `re_policy_${randomUUID()}`, status: "succeeded", amount: data.amount };
};

await db.insert(users).values(ids.map(id => ({
  id, email: `${id}@example.invalid`, stripeCustomerId: `cus_${id}`,
  ...(id === organiserId ? { stripeAccountId: "acct_policy_qa", payoutsEnabled: true } : {}),
})));
await db.insert(teams).values({ id: teamId, name: `Payment policy QA ${randomUUID()}`, sports: ["Football"], ownerId: organiserId });
await db.insert(teamMemberships).values(ids.slice(0, 4).map(userId => ({ teamId, userId, role: userId === organiserId ? "admin" : "member" })));
const app = x.express();
app.use(x.express.json());
x.registerEventPaymentPolicies(app, (req, res, next) => {
  req.userId = req.header("X-Test-User");
  if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
});
app.post("/api/events", async (req, res) => {
  try {
    const data = x.insertEventSchema.parse({ ...req.body, createdById: req.userId, venueOrganiserId: organiserId });
    const [event] = await db.insert(events).values(data).returning();
    eventIds.push(event.id);
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
const server = await new Promise(resolve => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function request(method, path, body, userId = memberId) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", "X-Test-User": userId },
    signal: AbortSignal.timeout(15000),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function event(policy, extra = {}) {
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const result = await request("POST", "/api/events", {
    name: "Payment policy fixture", sport: "Football", startDate: tomorrow, startTime: "16:00",
    endTime: "18:00", endDate: null, finalVenueCost: null, recurrenceEndDate: null, venueOrganiserId: null,
    location: "QA only", requirements: "Synthetic test event", primaryTeamId: teamId,
    paymentRequired: policy !== "none", paymentPolicy: policy, currency: "gbp",
    ...(policy.startsWith("fixed") ? { fixedPriceMinor: 1500 } : { maxPlayerPayment: "20.00" }),
    ...(policy === "fixed_threshold" ? { minimumPaidParticipants: 2, paymentDeadlineAt: new Date(Date.now() + 600_000).toISOString() } : {}),
    ...extra,
  }, organiserId);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}
after(async () => {
  Object.assign(stripe.paymentIntents, { create: original.create, retrieve: original.retrieve, confirm: original.confirm, cancel: original.cancel });
  stripe.charges.retrieve = original.charge;
  stripe.paymentMethods.retrieve = original.method;
  stripe.refunds.create = original.refund;
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => setTimeout(resolve, 500));
  if (eventIds.length) {
    const rows = await db.select({ id: eventPayments.id }).from(eventPayments).where(inArray(eventPayments.eventId, eventIds));
    if (rows.length) {
      await db.delete(paymentRefunds).where(inArray(paymentRefunds.eventPaymentId, rows.map(r => r.id)));
      await db.delete(paymentOperations).where(inArray(paymentOperations.eventPaymentId, rows.map(r => r.id)));
    }
    await db.delete(events).where(inArray(events.id, eventIds));
  }
  await db.delete(x.notifications).where(inArray(x.notifications.userId, ids));
  await db.delete(teams).where(eq(teams.id, teamId));
  await db.delete(users).where(inArray(users.id, ids));
  await Promise.all([x.apiPool.end(), x.pool.end()]);
});

test("schema accepts JSON ISO timestamps; rejects invalid dates, currencies and unsafe prices", () => {
  const settings = { paymentRequired: true, paymentPolicy: "fixed_threshold", fixedPriceMinor: 1000,
    minimumPaidParticipants: 2, paymentDeadlineAt: "2028-01-01T14:00:00Z",
    startDate: "2028-01-01", startTime: "16:00", endTime: "18:00" };
  const parsed = x.normalizeEventPaymentSettings(settings);
  assert.ok(parsed.paymentDeadlineAt instanceof Date);
  assert.equal(parsed.maxPlayerPayment, "10.00");
  for (const bad of [{ paymentDeadlineAt: "bad" }, { currency: "usd" }, { fixedPriceMinor: 0 },
    { fixedPriceMinor: 100.1 }, { minimumPaidParticipants: 0 }, { maxParticipants: 1 },
    { paymentDeadlineAt: "2028-01-02T00:00:00Z" }]) assert.throws(() => x.normalizeEventPaymentSettings({ ...settings, ...bad }));
  const free = x.normalizeEventPaymentSettings({ ...settings, paymentRequired: false });
  assert.equal(free.paymentPolicy, "none");
  assert.equal(free.fixedPriceMinor, null);
});
test("profile updates cannot replace server-owned Stripe identities or payout permissions", async () => {
  await x.storage.updateUserProfile(memberId, { firstName: "QA", stripeCustomerId: "cus_other_user", stripeAccountId: "acct_other_user", payoutsEnabled: true });
  const [user] = await db.select().from(users).where(eq(users.id, memberId));
  assert.equal(user.firstName, "QA");
  assert.equal(user.stripeCustomerId, `cus_${memberId}`);
  assert.equal(user.stripeAccountId, null);
  assert.equal(user.payoutsEnabled, false);
});
test("recurring instances retain policy, shift all deadlines and do not mutate their template", () => {
  const source = { startDate: "2028-01-01", paymentRequired: true, paymentPolicy: "fixed_threshold", currency: "gbp",
    fixedPriceMinor: 1200, minimumPaidParticipants: 3, paymentDeadlineAt: "2028-01-01T14:00:00Z",
    authorizationOpensAt: "2027-12-31T14:00:00Z", completionDueAt: "2028-01-02T14:00:00Z" };
  const next = x.recurringPaymentSettings(source, "2028-01-08");
  assert.equal(next.paymentDeadlineAt.toISOString(), "2028-01-08T14:00:00.000Z");
  assert.equal(next.authorizationOpensAt.toISOString(), "2028-01-07T14:00:00.000Z");
  assert.equal(next.completionDueAt.toISOString(), "2028-01-09T14:00:00.000Z");
  assert.equal(next.fixedPriceMinor, 1200);
  assert.equal(source.paymentDeadlineAt, "2028-01-01T14:00:00Z");
});
test("fixed checkout ignores client amounts, serializes retries, checks card ownership and gates mobile attendance", async () => {
  const e = await event("fixed_immediate");
  assert.equal((await request("POST", `/api/events/${e.id}/attendance`, { status: "attending" })).status, 402);
  assert.equal((await request("GET", `/api/events/${e.id}/payment-policy`, undefined, outsiderId)).status, 403);
  const before = createCalls.length;
  const attempts = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/api/payments/create-intent", { eventId: e.id, amount: 1, currency: "usd" })));
  assert.ok(attempts.every(r => r.status === 200), JSON.stringify(attempts));
  assert.equal(new Set(attempts.map(r => r.data.paymentIntentId)).size, 1);
  assert.equal(createCalls.length - before, 1);
  assert.equal(attempts[0].data.amount, 1500);
  assert.equal(attempts[0].data.captureMethod, "automatic");
  assert.equal((await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${outsiderId}` })).status, 403);
  const paid = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${memberId}` });
  assert.equal(paid.status, 200, JSON.stringify(paid.data));
  assert.equal(confirmCalls.at(-1).use_stripe_sdk, true, "Interactive checkout must return an SDK authentication action");
  assert.equal(paid.data.status, "captured");
  assert.equal((await request("GET", `/api/events/${e.id}/payment-status`)).data.hasAuthorization, true);
  assert.equal((await request("PUT", `/api/events/${e.id}`, { fixedPriceMinor: 2500 }, organiserId)).status, 409);
  assert.equal((await request("PUT", `/api/events/${e.id}`, { name: "Safe name update" }, organiserId)).status, 200);
  assert.equal((await request("DELETE", `/api/events/${e.id}`, undefined, organiserId)).status, 409);
  const unvote = await request("DELETE", `/api/events/${e.id}/vote`);
  assert.equal(unvote.status, 200);
  assert.equal(unvote.data.refundStatus, "succeeded");
  assert.equal(refundCalls.at(-1).data.amount, 1500);
  assert.equal(refundCalls.at(-1).data.reverse_transfer, true);
  assert.equal(refundCalls.at(-1).data.refund_application_fee, true);
  const [row] = await db.select().from(eventPayments).where(eq(eventPayments.eventId, e.id));
  assert.equal(row.refundedAmountMinor, 1500);
  assert.equal((await request("GET", `/api/events/${e.id}/payment-status`)).data.hasAuthorization, false);
});
test("SCA never confirms attendance until the provider reports success", async () => {
  const e = await event("fixed_immediate");
  const auth = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${memberId}_sca` });
  assert.equal(auth.data.requiresAction, true);
  assert.equal(auth.status, 409, "Both clients use HTTP 409 to start SCA");
  assert.equal(auth.data.success, false);
  assert.equal((await request("POST", `/api/events/${e.id}/attendance`, { status: "attending" })).status, 402);
  await stripe.paymentIntents.confirm(auth.data.paymentIntentId, { payment_method: `pm_${memberId}` });
  const done = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethod: "wallet", paymentIntentId: auth.data.paymentIntentId });
  assert.equal(done.data.success, true);
  const forged = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethod: "wallet", paymentIntentId: "pi_other_person" });
  assert.equal(forged.status, 409);
});
test("threshold failure refunds exactly once; threshold success does not refund", async () => {
  for (const count of [1, 2]) {
    const e = await event("fixed_threshold");
    for (const userId of [memberId, secondId].slice(0, count)) {
      const paid = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${userId}` }, userId);
      assert.equal(paid.data.success, true);
    }
    const [closed] = await db.update(events).set({ paymentDeadlineAt: new Date(Date.now() - 30_000) }).where(eq(events.id, e.id)).returning();
    const before = refundCalls.length;
    await x.reconcileThresholdEvent(closed);
    await x.reconcileThresholdEvent(closed);
    assert.equal(refundCalls.length - before, count === 1 ? 1 : 0);
    const [updated] = await db.select().from(events).where(eq(events.id, e.id));
    assert.equal(updated.paymentStatus, count === 1 ? "refunded" : "captured");
    assert.equal((await request("POST", "/api/payments/create-intent", { eventId: e.id }, thirdId)).status, 409);
  }
});
test("flexible mode uses a manual cap, enforces windows and releases holds on mobile withdrawal", async () => {
  const e = await event("flexible_post_event");
  const auth = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${memberId}` });
  assert.equal(auth.data.status, "authorized", JSON.stringify(auth.data));
  const intent = intents.get(auth.data.paymentIntentId);
  assert.equal(intent.capture_method, "manual");
  assert.equal(intent.amount, 2000);
  const [row] = await db.select().from(eventPayments).where(eq(eventPayments.eventId, e.id));
  assert.equal(row.authorizedAmountMinor, 2000);
  assert.ok(row.captureDeadlineAt);
  const cancelled = await request("POST", `/api/events/${e.id}/attendance`, { status: "maybe" });
  assert.equal(cancelled.status, 200);
  assert.equal(intents.get(intent.id).status, "canceled");
  const future = await event("flexible_post_event", { authorizationOpensAt: new Date(Date.now() + 3600_000).toISOString() });
  assert.equal((await request("POST", "/api/payments/create-intent", { eventId: future.id })).status, 409);
  assert.equal((await request("POST", "/api/payments/create-hold", { eventId: e.id, amount: 1 })).status, 410);
});

test("post-event recovery uses the organiser's final cost, not notification/client amounts, and requires new consent", async () => {
  const e = await event("flexible_post_event");
  const auth = await request("POST", `/api/events/${e.id}/authorize-payment`, { paymentMethodId: `pm_${memberId}` });
  await stripe.paymentIntents.cancel(auth.data.paymentIntentId);
  await db.update(eventPayments).set({ status: "cancelled" }).where(eq(eventPayments.eventId, e.id));
  const date = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  await db.update(events).set({
    startDate: date, startTime: "00:00", endDate: date, endTime: "00:01",
    finalVenueCost: "30.00", completionDueAt: new Date(Date.now() + 3600_000),
  }).where(eq(events.id, e.id));
  const [notice] = await db.insert(x.notifications).values({
    userId: memberId, type: "payment_authorization_required", title: "QA recovery", message: "Synthetic request",
    relatedId: e.id, metadata: JSON.stringify({ eventId: e.id, amount: "0.01" }),
  }).returning();
  const quote = await request("GET", `/api/events/${e.id}/payment-policy?notificationId=${notice.id}`);
  assert.equal(quote.data.amountMinor, 3000);
  assert.equal(quote.data.isRecovery, true);
  const paid = await request("POST", `/api/notifications/${notice.id}/authorize-payment`, { paymentMethodId: `pm_${memberId}` });
  assert.equal(paid.status, 200, JSON.stringify(paid.data));
  const intent = intents.get(paid.data.paymentIntentId);
  assert.equal(intent.amount, 3000);
  assert.equal(intent.capture_method, "automatic");
  assert.equal((await request("GET", `/api/events/${e.id}/payment-status`)).data.hasAuthorization, true);
  assert.equal((await request("POST", `/api/notifications/${notice.id}/authorize-payment`, { paymentMethodId: `pm_${secondId}` }, secondId)).status, 403);
});

test("a failed late-payment refund never validates attendance and is retried by the deadline worker", async () => {
  const e = await event("fixed_immediate");
  const created = await request("POST", "/api/payments/create-intent", { eventId: e.id });
  const intent = await stripe.paymentIntents.confirm(created.data.paymentIntentId, { payment_method: `pm_${memberId}` });
  charges.get(intent.latest_charge).created = Math.floor(Date.now() / 1000) + 60;
  const [closed] = await db.update(events).set({ paymentDeadlineAt: new Date(Date.now() - 30_000) }).where(eq(events.id, e.id)).returning();
  const adapter = stripe.refunds.create;
  stripe.refunds.create = async () => ({ id: `re_failed_${randomUUID()}`, status: "failed" });
  try {
    await assert.rejects(x.finalizeEventIntent(closed, memberId, intent.id), /has not completed/);
    assert.equal((await request("GET", `/api/events/${e.id}/payment-status`)).data.hasAuthorization, false);
  } finally { stripe.refunds.create = adapter; }
  await x.processPaymentDeadlines();
  const [row] = await db.select().from(eventPayments).where(eq(eventPayments.eventId, e.id));
  assert.equal(row.status, "refunded");
  assert.equal(row.refundedAmountMinor, 1500);
});