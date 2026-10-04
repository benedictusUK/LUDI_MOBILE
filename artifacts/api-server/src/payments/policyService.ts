import type Stripe from "stripe";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  eventPayments, events, users, payments, paymentOperations, paymentRefunds,
  effectivePaymentPolicy, paymentWindow,
  eventEndAt, calculatePlayerPrice,
} from "@workspace/db";
import { db } from "../db";
import { storage } from "../storage";
import { stripe, platformFeeBasisPoints } from "./stripeClient";
import { decimalToMinorUnits, calculatePercentageFeeMinor } from "./money";
import { allocateEvenlyMinor } from "./settlement";
import { retryFlexibleResiduals } from "./flexibleRefunds";

export class PaymentPolicyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Event = typeof events.$inferSelect;
type EventPayment = typeof eventPayments.$inferSelect;

export function amountForEvent(event: Event) {
  const amount = effectivePaymentPolicy(event) === "flexible_post_event"
    ? decimalToMinorUnits(event.maxPlayerPayment || "0") : event.fixedPriceMinor ?? 0;
  if (!Number.isSafeInteger(amount) || amount < 50 || amount > 99_999_999) {
    throw new PaymentPolicyError(400, "The event has no valid payment amount");
  }
  return event.feeConfiguration ? calculatePlayerPrice(amount, event.feeConfiguration).totalAmountMinor : amount;
}

export function priceForEvent(event: Event) {
  const base = effectivePaymentPolicy(event) === "flexible_post_event" ? decimalToMinorUnits(event.maxPlayerPayment || "0") : event.fixedPriceMinor ?? 0;
  return event.feeConfiguration ? calculatePlayerPrice(base, event.feeConfiguration) : {
    baseAmountMinor: base, platformFeeMinor: 0, processingFeeMinor: 0, totalAmountMinor: base,
  };
}
export const usesUpfrontRefunds = (event: Event) => !!event.feeConfiguration && effectivePaymentPolicy(event) === "flexible_post_event";

export async function requireEventAccess(eventId: string, userId: string) {
  const event = await storage.getEvent(eventId);
  if (!event) throw new PaymentPolicyError(404, "Event not found");
  const access = await db.execute(sql`SELECT 1 FROM events e WHERE e.id = ${eventId} AND (
    e.created_by_id = ${userId} OR e.venue_organiser_id = ${userId}
    OR EXISTS (SELECT 1 FROM team_memberships m WHERE m.team_id = e.primary_team_id AND m.user_id = ${userId})
    OR EXISTS (SELECT 1 FROM event_teams et JOIN team_memberships m ON m.team_id = et.team_id WHERE et.event_id = e.id AND m.user_id = ${userId})
    OR EXISTS (SELECT 1 FROM user_events f WHERE f.event_id = e.id AND f.user_id = ${userId}))`);
  if (!access.rows.length) throw new PaymentPolicyError(403, "You do not have access to this event");
  return event;
}

async function refundInProgress(row: EventPayment) {
  const [refund] = await db.select({ id: paymentRefunds.id }).from(paymentRefunds)
    .where(and(eq(paymentRefunds.eventPaymentId, row.id), inArray(paymentRefunds.status, ["pending", "succeeded", "requires_action"]),
      sql`COALESCE(${paymentRefunds.reason}, '') <> 'flexible_residual'`)).limit(1);
  return !!refund;
}

export async function hasValidEventPayment(event: Event, userId: string) {
  const row = await storage.getEventPayment(event.id, userId);
  if (!row?.paymentIntentId || await refundInProgress(row)) return false;
  const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
  const organiser = await storage.getUserById(event.venueOrganiserId || event.createdById);
  if (!row.stripeCustomerId || !organiser?.stripeAccountId) return false;
  verifyEventIntent(intent, event, userId, row.stripeCustomerId, organiser.stripeAccountId, row.agreedAmountMinor ?? amountForEvent(event));
  const charge = intent.latest_charge ? await stripe.charges.retrieve(typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge.id) : null;
  if (charge && (effectivePaymentPolicy(event) !== "flexible_post_event" || usesUpfrontRefunds(event)) && charge.created * 1000 > +paymentWindow(event).deadline) return false;
  if (charge && intent.metadata.ludiPaymentFlow === "post_event_recovery" && charge.created * 1000 > +paymentWindow(event).completion) return false;
  if (usesUpfrontRefunds(event) && row.settledBaseAmountMinor != null && intent.status === "succeeded") {
    const price = priceForEvent(event);
    const retained = row.settledBaseAmountMinor + price.platformFeeMinor + price.processingFeeMinor;
    return (row.status === "captured" || retained === 0 && row.status === "refunded") && intent.amount_received - (charge?.amount_refunded || 0) >= retained;
  }
  if ((charge?.amount_refunded || 0) > 0) return false;
  if (intent.status === "succeeded") return row.status === "captured" && (row.refundedAmountMinor || 0) === 0;
  if (effectivePaymentPolicy(event) !== "flexible_post_event" || intent.status !== "requires_capture") return false;
  const deadline = charge?.payment_method_details?.card?.capture_before;
  if (deadline && deadline * 1000 <= Date.now()) return false;
  return !row.captureDeadlineAt || row.captureDeadlineAt > new Date();
}

export async function getRecoveryRequest(event: Event, userId: string, notificationId: string, allowExpired = false) {
  const notification = await storage.getNotificationById(notificationId);
  let metadata: any;
  try { metadata = JSON.parse(notification?.metadata || "{}"); } catch { metadata = {}; }
  if (!notification || notification.userId !== userId || metadata.eventId !== event.id ||
    !["payment_authorization_required", "payment_required"].includes(notification.type)) {
    throw new PaymentPolicyError(403, "This payment request does not belong to you");
  }
  if (effectivePaymentPolicy(event) !== "flexible_post_event" || new Date() <= eventEndAt(event) ||
    (!allowExpired && new Date() >= paymentWindow(event).completion) || !event.finalVenueCost) {
    throw new PaymentPolicyError(409, "This post-event payment request is not available");
  }
  const organiserId = event.venueOrganiserId || event.createdById;
  const attendance = await storage.getEventAttendance(event.id);
  const attendeeIds = attendance.filter(a => ["attending", "promoted"].includes(a.status) && a.userId !== organiserId).map(a => a.userId);
  if (!attendeeIds.includes(userId)) throw new PaymentPolicyError(403, "Only registered participants can pay this event's final share");
  const amount = allocateEvenlyMinor(decimalToMinorUnits(event.finalVenueCost), attendeeIds).get(userId)!;
  if (amount < 50) throw new PaymentPolicyError(400, "The final share is below the minimum card charge");
  return { notificationId, amountMinor: amount };
}

export async function getPolicyQuote(event: Event, userId: string, notificationId?: string, executor: Pick<typeof db, "select"> = db) {
  const window = paymentWindow(event);
  const isOrganiser = userId === (event.venueOrganiserId || event.createdById);
  const recovery = notificationId ? await getRecoveryRequest(event, userId, notificationId) : null;
  if (recovery && usesUpfrontRefunds(event)) throw new PaymentPolicyError(409, "This event uses upfront payments, not post-event payment requests");
  const price = priceForEvent(event);
  const [counts] = await executor.select({ paid: sql<number>`count(*)`.mapWith(Number) }).from(eventPayments)
    .where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.status, "captured"),
      sql`COALESCE(${eventPayments.refundedAmountMinor},0) = 0`,
      sql`${eventPayments.capturedAmountMinor} >= COALESCE(${event.fixedPriceMinor},0)`,
      sql`NOT EXISTS (SELECT 1 FROM payment_refunds r WHERE r.event_payment_id = ${eventPayments.id} AND r.status IN ('pending','succeeded','requires_action'))`,
      window.policy === "fixed_threshold" ? sql`${eventPayments.capturedAt} <= ${window.deadline}` : undefined));
  return {
    paymentPolicy: window.policy, currency: event.currency || "gbp",
    paymentFlow: usesUpfrontRefunds(event) ? "upfront_refund" : window.policy === "flexible_post_event" ? "legacy_hold" : "immediate",
    baseAmountMinor: price.baseAmountMinor, platformFeeMinor: price.platformFeeMinor, processingFeeMinor: price.processingFeeMinor,
    feesFrozen: !!event.feeConfiguration, settledBaseAmountMinor: null as number | null,
    amountMinor: recovery?.amountMinor ?? (window.policy === "none" ? 0 : amountForEvent(event)),
    isRecovery: !!recovery, notificationId: recovery?.notificationId,
    minimumPaidParticipants: event.minimumPaidParticipants,
    paymentDeadlineAt: window.deadline, authorizationOpensAt: window.open,
    completionDueAt: window.policy === "flexible_post_event" ? window.completion : null,
    paidParticipants: counts.paid, thresholdMet: counts.paid >= (event.minimumPaidParticipants || 0),
    isOrganiser, canPay: (window.canPay || !!recovery) && !isOrganiser,
    reason: isOrganiser ? "The venue organiser does not need to pay to attend." : recovery ? null : window.reason,
  };
}

export function verifyEventIntent(intent: Stripe.PaymentIntent, event: Event, userId: string, customerId: string, destinationId: string, expectedAmount = amountForEvent(event)) {
  const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  const destination = typeof intent.transfer_data?.destination === "string"
    ? intent.transfer_data.destination : intent.transfer_data?.destination?.id;
  const policy = effectivePaymentPolicy(event);
  const recovery = policy === "flexible_post_event" && intent.metadata.ludiPaymentFlow === "post_event_recovery";
  if (intent.metadata.ludiEventId !== event.id || intent.metadata.ludiParticipantId !== userId ||
    intent.metadata.ludiOrganiserId !== (event.venueOrganiserId || event.createdById) ||
    customer !== customerId || destination !== destinationId ||
    intent.amount !== expectedAmount || intent.currency !== (event.currency || "gbp") ||
    (event.feeConfiguration && intent.application_fee_amount !== priceForEvent(event).platformFeeMinor + priceForEvent(event).processingFeeMinor) ||
    (usesUpfrontRefunds(event) && intent.metadata.ludiPaymentFlow !== "upfront_refund") ||
    intent.capture_method !== (policy === "flexible_post_event" && !recovery && !usesUpfrontRefunds(event) ? "manual" : "automatic") ||
    (intent.metadata.ludiPaymentPolicy && intent.metadata.ludiPaymentPolicy !== policy)) {
    throw new PaymentPolicyError(409, "The payment could not be verified against this event and participant");
  }
}

export async function getOrCreateEventIntent(event: Event, userId: string, notificationId?: string) {
  const quote = await getPolicyQuote(event, userId, notificationId);
  if (!quote.canPay) throw new PaymentPolicyError(409, quote.reason || "Payments are closed");
  const organiserId = event.venueOrganiserId || event.createdById;
  const [user, organiser] = await Promise.all([storage.getUserById(userId), storage.getUserById(organiserId)]);
  if (!user) throw new PaymentPolicyError(404, "Participant not found");
  if (!organiser?.stripeAccountId || !organiser.payoutsEnabled) throw new PaymentPolicyError(409, "The organiser must finish payout setup before accepting payments");
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { ludiUserId: userId } }, { idempotencyKey: `ludi-customer:${userId}` });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
  }
  // Persist the agreed terms before any Stripe operation, even if a subsequent
  // connection fails. A row lock serializes simultaneous web/mobile checkouts.
  await db.transaction(async tx => {
    const [currentEvent] = await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    if (!currentEvent || (!quote.isRecovery && amountForEvent(currentEvent) !== quote.amountMinor) ||
      effectivePaymentPolicy(currentEvent) !== quote.paymentPolicy || (!quote.isRecovery && !paymentWindow(currentEvent).canPay)) {
      throw new PaymentPolicyError(409, "The payment terms changed. Reload the event before paying.");
    }
    await tx.insert(eventPayments).values({
      eventId: event.id, userId, stripeCustomerId: customerId!, agreedAmountMinor: quote.amountMinor,
      currency: quote.currency, status: "setup_pending",
    }).onConflictDoNothing({ target: [eventPayments.eventId, eventPayments.userId] });
  });
  const intent = await db.transaction(async tx => {
    await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");
    const [row] = await tx.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.userId, userId))).for("update");
    const [refund] = await tx.select().from(paymentRefunds).where(and(eq(paymentRefunds.eventPaymentId, row.id), inArray(paymentRefunds.status, ["pending", "succeeded", "requires_action"]))).limit(1);
    if (refund || (row.refundedAmountMinor || 0) > 0) throw new PaymentPolicyError(409, "This registration has a refund. Contact the organiser before registering again.");
    if (row.paymentIntentId) {
      const current = await stripe.paymentIntents.retrieve(row.paymentIntentId);
      verifyEventIntent(current, event, userId, customerId!, organiser.stripeAccountId!, row.agreedAmountMinor ?? amountForEvent(event));
      if (quote.isRecovery && current.metadata.ludiNotificationId !== notificationId && current.status !== "canceled") {
        if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(current.status)) await stripe.paymentIntents.cancel(current.id);
        else throw new PaymentPolicyError(409, "An existing payment or authorization is already active. Ask the organiser to collect it instead.");
      } else if (current.status !== "canceled") {
        if (row.agreedAmountMinor != null && row.agreedAmountMinor !== quote.amountMinor) throw new PaymentPolicyError(409, "The payment terms have changed. Contact the organiser.");
        return current;
      }
    }
    if (!quote.isRecovery && row.agreedAmountMinor != null && row.agreedAmountMinor !== quote.amountMinor) throw new PaymentPolicyError(409, "The payment terms have changed. Contact the organiser.");
    const key = `event-intent:${row.id}:${row.paymentIntentId || "initial"}`;
    await tx.insert(paymentOperations).values({
      eventId: event.id, eventPaymentId: row.id, operationKey: key, kind: "authorize",
      stripeIdempotencyKey: key, status: "pending",
    }).onConflictDoNothing({ target: paymentOperations.operationKey });
    const created = await stripe.paymentIntents.create({
      amount: quote.amountMinor, currency: quote.currency, customer: customerId!,
      capture_method: quote.paymentPolicy === "flexible_post_event" && !quote.isRecovery && !usesUpfrontRefunds(event) ? "manual" : "automatic",
      payment_method_types: ["card"],
      application_fee_amount: event.feeConfiguration ? quote.platformFeeMinor + quote.processingFeeMinor : calculatePercentageFeeMinor(quote.amountMinor, platformFeeBasisPoints),
      transfer_data: { destination: organiser.stripeAccountId! }, on_behalf_of: organiser.stripeAccountId!,
      metadata: {
        ludiEventId: event.id, ludiParticipantId: userId, ludiOrganiserId: organiserId,
        ludiPaymentPolicy: quote.paymentPolicy, ludiPaymentFlow: usesUpfrontRefunds(event) ? "upfront_refund" : quote.isRecovery ? "post_event_recovery" : quote.paymentPolicy,
        ...(notificationId ? { ludiNotificationId: notificationId } : {}),
      },
    }, { idempotencyKey: key });
    await tx.update(eventPayments).set({
      paymentIntentId: created.id, stripeCustomerId: customerId!, paymentIntentStatus: created.status,
      agreedAmountMinor: quote.amountMinor, currency: quote.currency, updatedAt: new Date(), status: "setup_pending",
    }).where(eq(eventPayments.id, row.id));
    await tx.update(paymentOperations).set({ status: "succeeded", completedAt: new Date(), updatedAt: new Date() }).where(eq(paymentOperations.operationKey, key));
    return created;
  });
  return { intent, customerId, organiser };
}

export async function finalizeEventIntent(event: Event, userId: string, intentId: string) {
  const row = await storage.getEventPayment(event.id, userId);
  if (!row || row.paymentIntentId !== intentId || !row.stripeCustomerId) throw new PaymentPolicyError(409, "The payment is not associated with this registration");
  if (await refundInProgress(row)) throw new PaymentPolicyError(409, "This payment is being refunded");
  const organiser = await storage.getUserById(event.venueOrganiserId || event.createdById);
  if (!organiser?.stripeAccountId) throw new PaymentPolicyError(409, "The organiser cannot receive payments");
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.metadata.ludiPaymentFlow === "post_event_recovery") {
    await getRecoveryRequest(event, userId, intent.metadata.ludiNotificationId, true);
  }
  verifyEventIntent(intent, event, userId, row.stripeCustomerId, organiser.stripeAccountId, row.agreedAmountMinor ?? amountForEvent(event));
  if (usesUpfrontRefunds(event) && row.settledBaseAmountMinor != null) {
    if (!await hasValidEventPayment(event, userId)) throw new PaymentPolicyError(409, "This settled payment is not valid");
    return { success: true, paymentIntentId: intent.id, status: "captured", message: "Payment received; final venue cost already confirmed" };
  }
  const expectedStatus = effectivePaymentPolicy(event) === "flexible_post_event" && !usesUpfrontRefunds(event) && intent.metadata.ludiPaymentFlow !== "post_event_recovery" ? "requires_capture" : "succeeded";
  if (intent.status !== expectedStatus) return {
    success: false, requiresAction: intent.status === "requires_action", clientSecret: intent.client_secret,
    status: intent.status, paymentIntentId: intent.id, message: "Complete card authentication to confirm attendance",
  };
  const charge = intent.latest_charge ? await stripe.charges.retrieve(typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge.id) : null;
  const captureBefore = charge?.payment_method_details?.card?.capture_before;
  if (expectedStatus === "requires_capture" && new Date() >= paymentWindow(event).completion) {
    await refundRegistration(event, userId, "settlement_deadline");
    throw new PaymentPolicyError(409, "The settlement deadline has passed and the authorization has been released");
  }
  if (expectedStatus === "requires_capture" && captureBefore && new Date(captureBefore * 1000) <= paymentWindow(event).completion) {
    await stripe.paymentIntents.cancel(intent.id);
    throw new PaymentPolicyError(409, "This card authorization expires before the settlement deadline. Use a later authorization window.");
  }
  await db.transaction(async tx => {
    await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");
    const [locked] = await tx.select().from(eventPayments).where(eq(eventPayments.id, row.id)).for("update");
    if ((locked.refundedAmountMinor || 0) > 0) throw new PaymentPolicyError(409, "This payment has been refunded");
    await tx.update(eventPayments).set({
      status: expectedStatus === "succeeded" ? "captured" : "hold_created",
      paymentIntentStatus: intent.status, stripeChargeId: charge?.id,
      authorizedAmountMinor: intent.amount_capturable, capturedAmountMinor: intent.amount_received,
      captureDeadlineAt: captureBefore ? new Date(captureBefore * 1000) : null,
      holdAmount: (intent.amount / 100).toFixed(2), holdCreatedAt: new Date(),
      capturedAt: expectedStatus === "succeeded" ? new Date((charge?.created || Math.floor(Date.now() / 1000)) * 1000) : null,
      platformFeeMinor: intent.application_fee_amount || 0,
      organiserAmountMinor: Math.max(0, intent.amount_received - (intent.application_fee_amount || 0)),
      updatedAt: new Date(),
    }).where(eq(eventPayments.id, row.id));
    const [legacy] = await tx.select().from(payments).where(eq(payments.stripePaymentIntentId, intent.id)).limit(1);
    if (!legacy) await tx.insert(payments).values({
      userId, eventId: event.id, amount: (intent.amount / 100).toFixed(2), type: "event_fee",
      status: expectedStatus === "succeeded" ? "captured" : "authorized", stripePaymentIntentId: intent.id,
    });
  });
  // A late fixed-price confirmation cannot bypass its registration deadline.
  if (((effectivePaymentPolicy(event) !== "flexible_post_event" || usesUpfrontRefunds(event)) && new Date((charge?.created || 0) * 1000) > paymentWindow(event).deadline) ||
    (intent.metadata.ludiPaymentFlow === "post_event_recovery" && new Date((charge?.created || 0) * 1000) > paymentWindow(event).completion)) {
    const refund = await refundRegistration(event, userId, "late_payment");
    if (refund?.status === "failed" || refund?.status === "canceled") throw new PaymentPolicyError(503, "The late payment refund has not completed. It will be retried automatically.");
    throw new PaymentPolicyError(409, "The payment completed after the deadline and has been submitted for a full refund");
  }
  const attendance = await storage.voteOnEvent(event.id, userId, "attending");
  if (attendance?.status === "reserve") {
    const refund = await refundRegistration(event, userId, "event_full");
    if (refund?.status === "failed" || refund?.status === "canceled") throw new PaymentPolicyError(503, "The event filled and the refund has not completed. Please retry withdrawing your registration.");
    throw new PaymentPolicyError(409, "The event filled before your registration completed. Your payment has been released or submitted for a full refund.");
  }
  return { success: true, paymentIntentId: intent.id, status: expectedStatus === "succeeded" ? "captured" : "authorized",
    message: expectedStatus === "succeeded" ? "Payment received and attendance confirmed" : "Payment authorized and attendance confirmed" };
}

export async function refundRegistration(event: Event, userId: string, reason: string) {
  return db.transaction(async tx => {
    const [currentEvent] = await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    if (reason === "participant_withdrawal" && (effectivePaymentPolicy(currentEvent) !== "flexible_post_event" || usesUpfrontRefunds(currentEvent)) && (new Date() >= paymentWindow(currentEvent).deadline || currentEvent.paymentCollectionInitiated)) {
      throw new PaymentPolicyError(409, "The paid-registration withdrawal deadline has passed");
    }
    const [row] = await tx.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.userId, userId))).for("update");
    if (!row?.paymentIntentId) return;
    const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
    if (intent.status === "processing") throw new PaymentPolicyError(409, "This payment is still processing. Please wait before withdrawing.");
    if (reason === "participant_withdrawal" && effectivePaymentPolicy(currentEvent) === "flexible_post_event" && !usesUpfrontRefunds(currentEvent) && intent.status === "succeeded") {
      throw new PaymentPolicyError(409, "This event has already settled. Contact the organiser about refunds.");
    }
    if (intent.status !== "succeeded") {
      if (intent.status !== "canceled") await stripe.paymentIntents.cancel(intent.id);
      await tx.update(eventPayments).set({ status: "cancelled", paymentIntentStatus: "canceled", updatedAt: new Date() }).where(eq(eventPayments.id, row.id));
      await tx.update(payments).set({ status: "cancelled", updatedAt: new Date() }).where(eq(payments.stripePaymentIntentId, intent.id));
      return;
    }
    const requestKey = `registration-refund:${intent.id}`;
    const [existing] = await tx.select().from(paymentRefunds).where(eq(paymentRefunds.requestKey, requestKey));
    if (existing && ["pending", "succeeded", "requires_action"].includes(existing.status)) return { refundId: existing.stripeRefundId, status: existing.status };
    const amount = intent.amount_received - (row.refundedAmountMinor || 0);
    if (amount <= 0) return;
    await tx.insert(paymentRefunds).values({
      eventPaymentId: row.id, requestKey, amountMinor: amount, currency: intent.currency,
      status: "pending", reason, reverseTransfer: true, refundApplicationFee: true,
    }).onConflictDoNothing({ target: paymentRefunds.requestKey });
    const refund = await stripe.refunds.create({
      payment_intent: intent.id, amount, reverse_transfer: true, refund_application_fee: true,
      metadata: { ludiEventId: event.id, ludiParticipantId: userId, ludiRefundReason: reason },
    }, { idempotencyKey: existing?.stripeRefundId ? `${requestKey}:retry:${existing.stripeRefundId}` : requestKey });
    await tx.update(paymentRefunds).set({ stripeRefundId: refund.id, status: refund.status || "pending", updatedAt: new Date() }).where(eq(paymentRefunds.requestKey, requestKey));
    await tx.update(eventPayments).set({
      status: refund.status === "succeeded" ? "refunded" : refund.status === "failed" || refund.status === "canceled" ? row.status : "cancelled",
      refundedAmountMinor: refund.status === "succeeded" ? intent.amount_received : row.refundedAmountMinor,
      refundedAt: refund.status === "succeeded" ? new Date() : undefined, updatedAt: new Date(),
    }).where(eq(eventPayments.id, row.id));
    if (refund.status !== "failed" && refund.status !== "canceled") await tx.update(payments).set({ status: refund.status === "succeeded" ? "refunded" : "refund_pending", updatedAt: new Date() }).where(eq(payments.stripePaymentIntentId, intent.id));
    return { refundId: refund.id, status: refund.status };
  });
}

export async function reconcileThresholdEvent(event: Event) {
  if (effectivePaymentPolicy(event) !== "fixed_threshold" || new Date() < paymentWindow(event).deadline) return;
  const participants = await db.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
  // Refresh Stripe's state before making a threshold decision. A webhook delay
  // must never cause a successful on-time payment to be overlooked.
  for (const row of participants) {
    if (!row.paymentIntentId || row.status === "refunded" || await refundInProgress(row)) continue;
    const [failedRefund] = await db.select().from(paymentRefunds).where(and(eq(paymentRefunds.eventPaymentId, row.id), inArray(paymentRefunds.status, ["failed", "canceled"]))).limit(1);
    if (failedRefund) {
      await refundRegistration(event, row.userId, "refund_retry");
      continue;
    }
    const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
    if (intent.status === "succeeded") await finalizeEventIntent(event, row.userId, intent.id).catch(async error => {
      if (!(error instanceof PaymentPolicyError && error.message.includes("full refund"))) throw error;
    });
    else if (intent.status !== "canceled" && intent.status !== "processing") await refundRegistration(event, row.userId, "registration_deadline");
    // Do not decide while a card payment is still processing.
    else if (intent.status === "processing") return;
  }
  const thresholdMet = await db.transaction(async tx => {
    await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");
    const quote = await getPolicyQuote(event, event.createdById, undefined, tx);
    await tx.update(events).set({ paymentStatus: quote.thresholdMet ? "captured" : "holds_created" }).where(eq(events.id, event.id));
    return quote.thresholdMet;
  });
  if (!thresholdMet) {
    for (const row of participants) {
      await refundRegistration(event, row.userId, "minimum_participants_not_met");
      await storage.voteOnEvent(event.id, row.userId, "not_attending");
    }
    const afterRefunds = await db.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
    const complete = afterRefunds.every(row => (row.capturedAmountMinor || 0) <= (row.refundedAmountMinor || 0));
    await storage.updateEventPaymentStatus(event.id, complete ? "refunded" : "holds_created");
  } else {
    await storage.updateEventPaymentStatus(event.id, "captured");
  }
}

export async function processPaymentDeadlines() {
  const settlements = await db.select().from(events).where(and(
    eq(events.paymentPolicy, "flexible_post_event"), eq(events.paymentCollectionInitiated, true),
    eq(events.paymentStatus, "partial_captured"), sql`${events.feeConfiguration} IS NOT NULL`));
  for (const event of settlements) {
    try { await retryFlexibleResiduals(event); }
    catch (error) { console.error("Residual settlement retry failed", event.id, error instanceof Error ? error.name : "Error"); }
  }
  const due = await db.select().from(events).where(and(eq(events.paymentRequired, true),
    inArray(events.paymentPolicy, ["fixed_threshold", "fixed_immediate", "flexible_post_event"]),
    sql`CASE WHEN ${events.paymentPolicy} = 'flexible_post_event' THEN ${events.completionDueAt} <= NOW() ELSE ${events.paymentDeadlineAt} <= NOW() END`,
    sql`(${events.paymentStatus} NOT IN ('captured','refunded') OR EXISTS (
      SELECT 1 FROM event_payments p JOIN payment_refunds r ON r.event_payment_id = p.id
      WHERE p.event_id = ${events.id} AND r.status IN ('pending','failed','requires_action')))`));
  for (const event of due) {
    try {
    if (effectivePaymentPolicy(event) === "flexible_post_event") {
      if (usesUpfrontRefunds(event)) {
        const rows = await db.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
        for (const row of rows) {
          const [registrationRefund] = await db.select().from(paymentRefunds).where(and(eq(paymentRefunds.eventPaymentId, row.id),
            sql`COALESCE(${paymentRefunds.reason}, '') <> 'flexible_residual'`)).limit(1);
          if (registrationRefund && registrationRefund.status !== "succeeded") await refundRegistration(event, row.userId, "refund_retry");
        }
        continue;
      }
      const rows = await db.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
      let processing = false;
      for (const row of rows) {
        if (!row.paymentIntentId) continue;
        const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
        if (intent.status === "processing") processing = true;
        else if (!["succeeded", "canceled"].includes(intent.status)) await refundRegistration(event, row.userId, "settlement_deadline");
        else if (intent.status === "succeeded" && intent.metadata.ludiPaymentFlow === "post_event_recovery") {
          const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId);
            if (charge.created * 1000 > +paymentWindow(event).completion) await refundRegistration(event, row.userId, "late_payment");
          }
        }
      }
      if (!processing) await storage.updateEventPaymentStatus(event.id, rows.some(row => row.status === "captured") ? "captured" : "refunded");
    } else if (effectivePaymentPolicy(event) === "fixed_threshold") await reconcileThresholdEvent(event);
    else {
      const rows = await db.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
      let processing = false;
      for (const row of rows) {
        if (!row.paymentIntentId || row.status === "refunded") continue;
        const [refund] = await db.select().from(paymentRefunds).where(eq(paymentRefunds.eventPaymentId, row.id)).limit(1);
        if (refund && refund.status !== "succeeded") {
          const retried = await refundRegistration(event, row.userId, "refund_retry");
          if (retried?.status !== "succeeded") processing = true;
          continue;
        }
        const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
        if (intent.status === "succeeded") await finalizeEventIntent(event, row.userId, intent.id).catch(error => {
          if (!(error instanceof PaymentPolicyError && error.message.includes("full refund"))) throw error;
        });
        else if (intent.status !== "processing" && intent.status !== "canceled") await refundRegistration(event, row.userId, "registration_deadline");
        else if (intent.status === "processing") processing = true;
      }
      if (!processing) await storage.updateEventPaymentStatus(event.id, "captured");
    }
    } catch (error: any) {
      console.error("Payment deadline processing will retry", event.id, error.name);
    }
  }
}