import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { events, eventPayments, paymentRefunds, calculatePlayerPrice, residualRefundMinor, eventEndAt, type Event } from "@workspace/db";
import { db } from "../db";
import { storage } from "../storage";
import { stripe } from "./stripeClient";
import { decimalToMinorUnits } from "./money";
import { allocateEvenlyMinor } from "./settlement";
import { PaymentPolicyError, verifyEventIntent } from "./policyService";

const residualReason = "flexible_residual";

// A durable allocation is committed before talking to Stripe. A retry cannot
// change attendance, fees, final cost, or a participant's refund amount.
export async function settleFlexibleEvent(event: Event, actorId: string, venueCost: unknown) {
  if (!event.feeConfiguration || event.paymentPolicy !== "flexible_post_event") throw new PaymentPolicyError(409, "This event does not use upfront payments");
  if (new Date() <= eventEndAt(event)) throw new PaymentPolicyError(409, "Finalise the venue cost after the event ends");
  if (typeof venueCost !== "string" && typeof venueCost !== "number") throw new PaymentPolicyError(400, "Final venue cost is required");
  let finalCost: number;
  try { finalCost = decimalToMinorUnits(String(venueCost)); } catch { throw new PaymentPolicyError(400, "Enter a valid final venue cost in pounds"); }
  if (finalCost < 0 || finalCost > 99999999) throw new PaymentPolicyError(400, "Final venue cost is out of range");
  await db.transaction(async tx => {
    const [current] = await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    if (current.paymentCollectionInitiated) {
      if (decimalToMinorUnits(current.finalVenueCost || "0") !== finalCost) throw new PaymentPolicyError(409, "The final cost is already frozen. Retry using the original final cost.");
      return;
    }
    const organiserId = current.venueOrganiserId || current.createdById;
    const attendance = await storage.getEventAttendance(current.id);
    const ids = attendance.filter(a => ["attending", "promoted"].includes(a.status) && a.userId !== organiserId).map(a => a.userId);
    if (!ids.length) throw new PaymentPolicyError(409, "There are no paid participants to settle");
    const rows = await tx.select().from(eventPayments).where(and(eq(eventPayments.eventId, current.id), inArray(eventPayments.userId, ids))).for("update");
    const price = calculatePlayerPrice(decimalToMinorUnits(current.maxPlayerPayment!), current.feeConfiguration!);
    if (rows.length !== ids.length || rows.some(p => p.status !== "captured" || !p.paymentIntentId ||
      p.agreedAmountMinor !== price.totalAmountMinor || p.capturedAmountMinor !== price.totalAmountMinor || (p.refundedAmountMinor || 0) > 0)) {
      throw new PaymentPolicyError(409, "Every attending participant must have completed their upfront payment before finalising refunds");
    }
    const shares = allocateEvenlyMinor(finalCost, rows.map(p => p.id));
    if (rows.some(p => shares.get(p.id)! > price.baseAmountMinor)) throw new PaymentPolicyError(409, "The final venue share exceeds a player's agreed maximum. No extra payment has been taken and no refunds have been issued.");
    for (const row of rows) {
      const share = shares.get(row.id)!;
      const refundAmount = residualRefundMinor(price.baseAmountMinor, share);
      await tx.update(eventPayments).set({ settledBaseAmountMinor: share, updatedAt: new Date() }).where(eq(eventPayments.id, row.id));
      if (refundAmount > 0) await tx.insert(paymentRefunds).values({
        eventPaymentId: row.id, requestKey: `flexible-residual:${row.paymentIntentId}`,
        amountMinor: refundAmount, currency: row.currency, status: "pending",
        reason: residualReason, reverseTransfer: true, refundApplicationFee: false,
      }).onConflictDoNothing({ target: paymentRefunds.requestKey });
    }
    await tx.update(events).set({
      finalVenueCost: (finalCost / 100).toFixed(2), paymentCollectionInitiated: true,
      paymentCollectionInitiatedAt: new Date(), paymentCollectionInitiatedBy: actorId,
      paymentStatus: "partial_captured", updatedAt: new Date(),
    }).where(eq(events.id, current.id));
  });
  return retryFlexibleResiduals(event);
}

export async function retryFlexibleResiduals(event: Event) {
  const planned = await db.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id),
    // Only a persisted settlement plan can initiate a residual refund.
    inArray(eventPayments.status, ["captured", "refunded"])));
  const rows = planned.filter(p => p.settledBaseAmountMinor != null);
  const results: { paymentId: string; userId: string; amount: string; status: string }[] = [];
  let failedRefunds = 0, pendingRefunds = 0, successfulRefunds = 0, totalRefunded = 0;
  const organiser = await storage.getUserById(event.venueOrganiserId || event.createdById);
  const price = calculatePlayerPrice(decimalToMinorUnits(event.maxPlayerPayment!), event.feeConfiguration!);
  for (const row of rows) {
    const amount = residualRefundMinor(price.baseAmountMinor, row.settledBaseAmountMinor!);
    try {
      let status = "succeeded";
      if (amount > 0) {
        status = await db.transaction(async tx => {
          await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");
          const [refundRow] = await tx.select().from(paymentRefunds).where(eq(paymentRefunds.requestKey, `flexible-residual:${row.paymentIntentId}`)).for("update");
          if (!refundRow) throw new Error("Missing durable refund request");
          const repairLedger = async () => {
            const [latest] = await tx.select().from(eventPayments).where(eq(eventPayments.id, row.id)).for("update");
            if (!latest) throw new Error("Missing participant payment");
            const cumulative = Math.max(latest.refundedAmountMinor || 0, amount);
            await tx.update(eventPayments).set({
              refundedAmountMinor: cumulative, refundAmount: (cumulative / 100).toFixed(2), refundedAt: new Date(),
              finalAmount: (((latest.capturedAmountMinor || 0) - cumulative) / 100).toFixed(2),
              organiserAmountMinor: Math.max(0, price.baseAmountMinor - cumulative), updatedAt: new Date(),
            }).where(eq(eventPayments.id, row.id));
          };
          if (refundRow.status === "succeeded") { await repairLedger(); return refundRow.status; }
          const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId!);
          if (!row.stripeCustomerId || !organiser?.stripeAccountId) throw new Error("Payment ownership is incomplete");
          verifyEventIntent(intent, event, row.userId, row.stripeCustomerId, organiser.stripeAccountId, row.agreedAmountMinor!);
          if (intent.status !== "succeeded" || intent.amount_received !== price.totalAmountMinor) throw new Error("The upfront payment has not completed");
          // Stripe's idempotency cache is finite. Recover an unknown outcome
          // from provider metadata even if a retry happens days later.
          let known: Stripe.Refund | null = refundRow.stripeRefundId ? await stripe.refunds.retrieve(refundRow.stripeRefundId) : null;
          if (!known || ["failed", "canceled"].includes(known.status || "")) {
            await stripe.refunds.list({ payment_intent: intent.id, limit: 100 }).autoPagingEach(candidate => {
              if (candidate.metadata?.ludiRefundRequestKey === refundRow.requestKey) { known = candidate; return false; }
              return true;
            });
          }
          if (known && (known.amount !== refundRow.amountMinor || known.currency !== refundRow.currency)) throw new Error("Provider refund does not match the agreed residual");
          const retry = known && ["failed", "canceled"].includes(known.status || "");
          const refund = known && !retry
            ? known
            : await stripe.refunds.create({
              payment_intent: intent.id, amount: refundRow.amountMinor,
              reverse_transfer: true, refund_application_fee: false,
              metadata: { ludiEventId: event.id, ludiParticipantId: row.userId,
                ludiRefundReason: residualReason, ludiRefundRequestKey: refundRow.requestKey },
            }, { idempotencyKey: retry ? `${refundRow.requestKey}:retry:${known!.id}` : refundRow.requestKey });
          await tx.update(paymentRefunds).set({ stripeRefundId: refund.id, status: refund.status || "pending", updatedAt: new Date() }).where(eq(paymentRefunds.id, refundRow.id));
          if (refund.status === "succeeded") await repairLedger();
          return refund.status || "pending";
        });
      }
      if (status === "succeeded") { successfulRefunds++; totalRefunded += amount; }
      else if (["failed", "canceled"].includes(status)) failedRefunds++;
      else pendingRefunds++;
      results.push({ paymentId: row.id, userId: row.userId, amount: (amount / 100).toFixed(2), status });
    } catch (error) {
      failedRefunds++;
      results.push({ paymentId: row.id, userId: row.userId, amount: (amount / 100).toFixed(2), status: "retry_required" });
      console.error("Residual refund will be retried", row.id, error instanceof Error ? error.name : "Error");
    }
  }
  const settlementComplete = rows.length > 0 && failedRefunds === 0 && pendingRefunds === 0;
  if (rows.length) await storage.updateEventPaymentStatus(event.id, settlementComplete ? "captured" : "partial_captured");
  return {
    message: settlementComplete ? "Final cost confirmed. Residual refunds completed; original fees retained." : "Final cost is frozen. Some refunds are pending or need retrying; do not create a second settlement.",
    settlementComplete, paymentFlow: "upfront_refund", successfulRefunds, pendingRefunds, failedRefunds,
    totalRefunded: (totalRefunded / 100).toFixed(2), results,
  };
}