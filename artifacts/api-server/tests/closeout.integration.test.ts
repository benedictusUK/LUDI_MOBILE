import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { stripe } from "../src/payments/stripeClient";
import { users, teams, teamMemberships, events, eventAttendance, eventPayments,
  eventCloseouts, eventCloseoutLinks, eventCloseoutRefunds, payments, calculatePlayerPrice } from "@workspace/db";
import { ensureCloseout, getCloseoutState, syncLinks } from "../src/payments/closeoutState";
import { saveCloseout, reconcileCloseout, createCloseoutLink, closeEvent } from "../src/payments/closeoutService";
import { verifyEventIntent, hasValidEventPayment } from "../src/payments/policyService";

test("mixed cash/online/late-player closeout: venue-only refunds, one-time links, stale quotes and payout retries", async t => {
  // Future DB dates prevent the running real scheduler from touching fixtures.
  // Only this test's clock is advanced, and ALL Stripe calls are mocked.
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 2) });
  const suffix = randomUUID();
  const ids = ["organiser", "online", "cash", "late"].map(role => `close-test-${role}-${suffix}`);
  const [organiser, online, cash, late] = ids;
  const teamId = `close-test-team-${suffix}`, eventId = `close-test-event-${suffix}`;
  const underfundedId = `close-test-underfunded-${suffix}`;
  const fixtureEvents = [eventId, underfundedId];
  const fees = { platformBasisPoints: 500, stripeBasisPoints: 299, stripeFixedMinor: 0, revision: 1, payoutFlow: "on_close" as const };
  const upfront = calculatePlayerPrice(1200, fees);
  const intents = new Map<string, any>(), charges = new Map<string, any>(), refunds = new Map<string, any>(), sessions = new Map<string, any>(), transfers = new Map<string, any>();
  let refundResponseLost = false, transferResponseLost = false;
  let cancellations = 0;
  const required = (map: Map<string, any>, id: string) => { assert.ok(map.has(id), `Unexpected Stripe fixture lookup: ${id}`); return map.get(id); };
  t.mock.method(stripe.paymentIntents, "retrieve", async (id: string) => required(intents, id));
  t.mock.method(stripe.paymentIntents, "cancel", async (id: string) => { cancellations++; const intent = required(intents, id); intent.status = "canceled"; return intent; });
  t.mock.method(stripe.charges, "retrieve", async (id: string) => required(charges, id));
  t.mock.method(stripe.accounts, "retrieve", async () => ({ id: "acct_fixture_organiser", payouts_enabled: true, capabilities: { transfers: "active" } }));
  t.mock.method(stripe.refunds, "list", async ({ payment_intent }: any) => ({ data: [...refunds.values()].filter(r => r.payment_intent === payment_intent) }));
  t.mock.method(stripe.refunds, "retrieve", async (id: string) => [...refunds.values()].find(r => r.id === id) || assert.fail("Unknown refund"));
  t.mock.method(stripe.refunds, "create", async (params: any, options: any) => {
    assert.equal(params.reverse_transfer, undefined);
    assert.equal(params.refund_application_fee, undefined);
    if (refunds.has(options.idempotencyKey)) return refunds.get(options.idempotencyKey);
    const intent = required(intents, params.payment_intent), charge = required(charges, intent.latest_charge);
    const refund = { id: `re_${refunds.size}`, status: "succeeded", ...params };
    refunds.set(options.idempotencyKey, refund);
    charge.amount_refunded += params.amount;
    if (!refundResponseLost) { refundResponseLost = true; throw new Error("Simulated lost refund response"); }
    return refund;
  });
  t.mock.method(stripe.products, "create", async () => ({ id: "prod_fixture" }));
  t.mock.method(stripe.prices, "create", async (p: any) => { assert.equal(p.unit_amount, 1082); return { id: "price_fixture" }; });
  t.mock.method(stripe.checkout.sessions, "create", async (params: any, options: any) => {
    const session = { id: `cs_${options.idempotencyKey}`, status: "open", payment_status: "unpaid", amount_total: 1082,
      metadata: params.metadata, url: "https://example.invalid/one-time-checkout" };
    sessions.set(session.id, session);
    return session;
  });
  t.mock.method(stripe.checkout.sessions, "retrieve", async (id: string) => required(sessions, id));
  t.mock.method(stripe.checkout.sessions, "expire", async (id: string) => { const session = required(sessions, id); session.status = "expired"; return session; });
  t.mock.method(stripe.transfers, "create", async (params: any, options: any) => {
    if (transfers.has(options.idempotencyKey)) return transfers.get(options.idempotencyKey);
    assert.equal(params.destination, "acct_fixture_organiser");
    const transfer = { id: `tr_${transfers.size}`, ...params };
    transfers.set(options.idempotencyKey, transfer);
    if (!transferResponseLost) { transferResponseLost = true; throw new Error("Simulated lost transfer response"); }
    return transfer;
  });
  t.after(async () => {
    await db.delete(eventCloseoutRefunds).where(inArray(eventCloseoutRefunds.eventId, fixtureEvents));
    await db.delete(eventCloseoutLinks).where(inArray(eventCloseoutLinks.eventId, fixtureEvents));
    await db.delete(eventCloseouts).where(inArray(eventCloseouts.eventId, fixtureEvents));
    await db.delete(eventPayments).where(inArray(eventPayments.eventId, fixtureEvents));
    await db.delete(payments).where(inArray(payments.eventId, fixtureEvents));
    await db.delete(eventAttendance).where(inArray(eventAttendance.eventId, fixtureEvents));
    await db.delete(events).where(inArray(events.id, fixtureEvents));
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, teamId));
    await db.delete(teams).where(eq(teams.id, teamId));
    await db.delete(users).where(inArray(users.id, ids));
    await db.$client.end();
  });
  await db.insert(users).values(ids.map((id, i) => ({ id, email: `${id}@example.invalid`, firstName: ["Organiser", "Online", "Cash", "Late"][i],
    stripeAccountId: i === 0 ? "acct_fixture_organiser" : null, payoutsEnabled: i === 0 })));
  await db.insert(teams).values({ id: teamId, name: teamId, ownerId: organiser });
  await db.insert(teamMemberships).values(ids.map(userId => ({ teamId, userId })));
  const [event] = await db.insert(events).values({ id: eventId, name: "Isolated payment closeout fixture", sport: "Football",
    startDate: "2029-01-01", startTime: "18:00", endDate: "2029-01-01", endTime: "19:00",
    primaryTeamId: teamId, createdById: organiser, venueOrganiserId: organiser,
    cost: "40.00", paymentRequired: true, paymentPolicy: "flexible_post_event", maxPlayerPayment: "12.00",
    feeConfiguration: fees, currency: "gbp" }).returning();
  await db.insert(eventAttendance).values([organiser, online, cash].map(userId => ({ eventId, userId, status: "attending" as const })));
  for (const userId of [online, cash]) {
    const intentId = `pi_${userId}`, chargeId = `ch_${userId}`;
    intents.set(intentId, { id: intentId, status: "succeeded", amount: upfront.totalAmountMinor, amount_received: upfront.totalAmountMinor,
      currency: "gbp", capture_method: "automatic", customer: `cus_${userId}`, latest_charge: chargeId,
      metadata: { ludiEventId: eventId, ludiParticipantId: userId, ludiOrganiserId: organiser, ludiPayoutFlow: "on_close", ludiPaymentFlow: "upfront_refund", ludiPaymentPolicy: "flexible_post_event" } });
    charges.set(chargeId, { id: chargeId, created: Date.UTC(2028, 11, 31) / 1000, amount_refunded: 0, disputed: false });
    await db.insert(eventPayments).values({ eventId, userId, paymentIntentId: intentId, stripeChargeId: chargeId, stripeCustomerId: `cus_${userId}`,
      status: "captured", paymentIntentStatus: "succeeded", agreedAmountMinor: upfront.totalAmountMinor, capturedAmountMinor: upfront.totalAmountMinor,
      platformFeeMinor: 98, organiserAmountMinor: 1200, currency: "gbp", capturedAt: new Date("2028-12-31") });
    assert.doesNotThrow(() => verifyEventIntent(required(intents, intentId), event, userId, `cus_${userId}`, "acct_fixture_organiser"));
    assert.throws(() => verifyEventIntent({ ...required(intents, intentId), transfer_data: { destination: "acct_fixture_organiser" } }, event, userId, `cus_${userId}`, "acct_fixture_organiser"));
  }
  await ensureCloseout(event);
  assert.ok((await getCloseoutState(event)).candidates.some(c => c.userId === late)); // Never voted or paid.
  await assert.rejects(saveCloseout(event, 4000, [{ userId: online, method: "online", cashAmountMinor: 0 }, { userId: online, method: "cash", cashAmountMinor: 1 }]));
  await saveCloseout(event, 4000, ids.map(userId => ({ userId, method: userId === cash ? "cash" : "online", cashAmountMinor: userId === cash ? 1000 : 0 })));
  const pendingIntentId = "pi_original_unpaid_fixture";
  intents.set(pendingIntentId, { ...required(intents, `pi_${online}`), id: pendingIntentId, latest_charge: null,
    amount_received: 0, customer: `cus_${late}`, status: "processing",
    metadata: { ...required(intents, `pi_${online}`).metadata, ludiParticipantId: late } });
  await db.insert(eventPayments).values({ eventId, userId: late, paymentIntentId: pendingIntentId,
    stripeCustomerId: `cus_${late}`, agreedAmountMinor: upfront.totalAmountMinor, status: "setup_pending" });
  await assert.rejects(reconcileCloseout(event), /still processing/);
  assert.equal(refunds.size, 0);
  required(intents, pendingIntentId).status = "requires_payment_method";
  const first = await reconcileCloseout(event);
  assert.equal(cancellations, 1);
  assert.equal(first.refundPending, true); // Lost network response is not treated as confirmed.
  const reconciled = await reconcileCloseout(event);
  assert.equal(reconciled.refundPending, false);
  assert.equal(await hasValidEventPayment(event, online), true);
  assert.equal(refunds.size, 2); // Retry finds the original successful refund.
  assert.equal(required(charges, `ch_${online}`).amount_refunded, 200);
  assert.equal(required(charges, `ch_${cash}`).amount_refunded, 1200);
  assert.equal(reconciled.payoutMinor, 1000);
  assert.equal(reconciled.shortfallMinor, 1000);
  assert.equal(transfers.size, 0); // Reconcile must never release organiser funds.
  const created = await createCloseoutLink(event, late);
  assert.equal((await createCloseoutLink(event, late)).url, created.url);
  assert.equal(sessions.size, 1);
  const session = [...sessions.values()][0], lateIntent = "pi_late_fixture", lateCharge = "ch_late_fixture";
  session.status = "complete"; session.payment_status = "paid"; session.payment_intent = lateIntent;
  intents.set(lateIntent, { id: lateIntent, status: "succeeded", amount_received: 1082, currency: "gbp", latest_charge: lateCharge, metadata: session.metadata });
  charges.set(lateCharge, { id: lateCharge, amount_refunded: 0, disputed: false });
  await syncLinks(event);
  await assert.rejects(closeEvent(event, organiser, reconciled.payoutMinor, reconciled.revision)); // Late payment changed quote.
  const ready = await getCloseoutState(event);
  assert.equal(await hasValidEventPayment(event, late), true);
  assert.equal(ready.payoutMinor, 2000);
  assert.equal(ready.shortfallMinor, 0);
  await assert.rejects(createCloseoutLink(event, late));
  const closing = await closeEvent(event, organiser, ready.payoutMinor, ready.revision);
  assert.equal(closing.status, "closing");
  assert.match(closing.payoutError!, /lost transfer/);
  const closed = await closeEvent(event, organiser, closing.payoutMinor, closing.revision);
  assert.equal(closed.status, "closed");
  assert.equal([...transfers.values()].reduce((sum, tr) => sum + tr.amount, 0), 2000);
  await closeEvent(event, organiser, closed.payoutMinor, closed.revision);
  assert.equal(transfers.size, 2); // Repeated Close cannot create another payout.
  await assert.rejects(saveCloseout(event, 4000, []));

  // All original players paid their agreed maximum. A higher actual venue
  // bill creates a monetary shortage, not a demand for extra card charges.
  const [underfunded] = await db.insert(events).values({ ...event, id: underfundedId, cost: "50.00" }).returning();
  await db.insert(eventAttendance).values(ids.map(userId => ({ eventId: underfundedId, userId, status: "attending" as const })));
  for (const userId of ids.filter(id => id !== organiser)) {
    const intentId = `pi_cap_${userId}`, chargeId = `ch_cap_${userId}`;
    intents.set(intentId, { ...required(intents, `pi_${online}`), id: intentId, customer: `cus_${userId}`, latest_charge: chargeId,
      metadata: { ...required(intents, `pi_${online}`).metadata, ludiEventId: underfundedId, ludiParticipantId: userId } });
    charges.set(chargeId, { id: chargeId, created: Date.UTC(2028, 11, 31) / 1000, amount_refunded: 0, disputed: false });
    await db.insert(eventPayments).values({ eventId: underfundedId, userId, paymentIntentId: intentId, stripeChargeId: chargeId,
      stripeCustomerId: `cus_${userId}`, status: "captured", paymentIntentStatus: "succeeded",
      agreedAmountMinor: upfront.totalAmountMinor, capturedAmountMinor: upfront.totalAmountMinor,
      platformFeeMinor: 98, organiserAmountMinor: 1200, currency: "gbp", capturedAt: new Date("2028-12-31") });
  }
  await ensureCloseout(underfunded);
  const shortage = await reconcileCloseout(underfunded);
  assert.equal(shortage.payoutMinor, 3600);
  assert.equal(shortage.shortfallMinor, 150);
  assert.equal(await hasValidEventPayment(underfunded, online), true);
  const shortClosed = await closeEvent(underfunded, organiser, shortage.payoutMinor, shortage.revision);
  assert.equal(shortClosed.status, "closed");
  assert.equal(shortClosed.payoutMinor, 3600);
});
