import type { Request, Response } from "express";
import type Stripe from "stripe";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  eventPayments,
  paymentDisputes,
  paymentRefunds,
  paymentTransfers,
  payments,
  stripeWebhookEvents,
  users,
} from "@workspace/db";
import { db } from "../db";
import { logger } from "../lib/logger";
import { stripe } from "../payments/stripeClient";

function stripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}

function safeWebhookError(error: unknown): string {
  if (error instanceof Error) {
    return error.name.slice(0, 100);
  }
  return "UnknownWebhookError";
}

function expandableId(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

async function updatePaymentIntentState(receivedIntent: Stripe.PaymentIntent) {
  // Webhooks may be delivered out of order. Always reconcile the current
  // provider state instead of allowing an older authorization to undo capture.
  const paymentIntent = await stripe.paymentIntents.retrieve(receivedIntent.id);
  const domainStatus =
    paymentIntent.status === "succeeded"
      ? "paid"
      : paymentIntent.status === "requires_capture"
        ? "authorized"
        : paymentIntent.status === "canceled"
          ? "cancelled"
          : paymentIntent.status === "requires_payment_method"
            ? "failed"
            : "pending";

  const chargeId = expandableId(paymentIntent.latest_charge);
  const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
  const balanceTransactionId = expandableId(charge?.balance_transaction);
  const balanceTransaction = balanceTransactionId
    ? await stripe.balanceTransactions.retrieve(balanceTransactionId)
    : null;
  const captureBefore = charge?.payment_method_details?.card?.capture_before;

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: sql`CASE WHEN ${payments.status} IN ('refunded','refund_pending') THEN ${payments.status} ELSE ${domainStatus} END`,
        paidAt: paymentIntent.status === "succeeded" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

    const eventPaymentStatus =
      paymentIntent.status === "succeeded"
        ? "captured"
        : paymentIntent.status === "requires_capture"
          ? "hold_created"
          : paymentIntent.status === "canceled"
            ? "cancelled"
            : undefined;

    const [eventPayment] = await tx
      .update(eventPayments)
      .set({
        paymentIntentStatus: paymentIntent.status,
        stripeChargeId: chargeId,
        stripeBalanceTransactionId: balanceTransactionId,
        authorizedAmountMinor: paymentIntent.status === "requires_capture"
          ? paymentIntent.amount_capturable
          : undefined,
        capturedAmountMinor: paymentIntent.amount_received,
        stripeFeeMinor: balanceTransaction?.fee,
        captureDeadlineAt: captureBefore ? new Date(captureBefore * 1000) : undefined,
        ...(eventPaymentStatus ? { status: sql`CASE WHEN COALESCE(${eventPayments.refundedAmountMinor},0) > 0 AND COALESCE(${eventPayments.refundedAmountMinor},0) >= ${paymentIntent.amount_received} THEN 'refunded' ELSE ${eventPaymentStatus} END` } : {}),
        ...(paymentIntent.status === "succeeded"
           ? { capturedAt: new Date((charge?.created || Math.floor(Date.now() / 1000)) * 1000) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventPayments.paymentIntentId, paymentIntent.id))
      .returning({ id: eventPayments.id });

    const transferId = expandableId(charge?.transfer);
    // An earlier authorization event may arrive after the charge was captured.
    // Do not reserve the unique transfer receipt with its uncaptured amount.
    if (paymentIntent.status === "succeeded" && eventPayment && transferId && paymentIntent.transfer_data?.destination) {
      const destination = typeof paymentIntent.transfer_data.destination === "string"
        ? paymentIntent.transfer_data.destination
        : paymentIntent.transfer_data.destination.id;
      await tx.insert(paymentTransfers).values({
        eventPaymentId: eventPayment.id,
        stripeTransferId: transferId,
        destinationAccountId: destination,
        amountMinor: Math.max(paymentIntent.amount_received - (paymentIntent.application_fee_amount ?? 0), 0),
        currency: paymentIntent.currency,
        status: "created",
      }).onConflictDoNothing({ target: paymentTransfers.stripeTransferId });
    }
  });
}

async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      await updatePaymentIntentState(event.data.object);
      return;

    case "setup_intent.succeeded": {
      const setupIntent = event.data.object;
      await db
        .update(eventPayments)
        .set({
          setupIntentStatus: "succeeded",
          paymentMethodId:
            typeof setupIntent.payment_method === "string"
              ? setupIntent.payment_method
              : setupIntent.payment_method?.id,
          status: "setup_complete",
          updatedAt: new Date(),
        })
        .where(eq(eventPayments.setupIntentId, setupIntent.id));
      return;
    }

    case "setup_intent.canceled":
    case "setup_intent.setup_failed": {
      const setupIntent = event.data.object;
      await db
        .update(eventPayments)
        .set({
          setupIntentStatus:
            setupIntent.status === "canceled"
              ? "canceled"
              : "requires_payment_method",
          status: "setup_pending",
          updatedAt: new Date(),
        })
        .where(eq(eventPayments.setupIntentId, setupIntent.id));
      return;
    }

    case "account.updated": {
      const account = event.data.object;
      await db
        .update(users)
        .set({
          payoutsEnabled: account.payouts_enabled && account.charges_enabled,
          updatedAt: new Date(),
        })
        .where(eq(users.stripeAccountId, account.id));
      return;
    }

    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const refund = await stripe.refunds.retrieve(event.data.object.id);
      const paymentIntentId = typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : refund.payment_intent?.id;
      if (!paymentIntentId) return;
      const [eventPayment] = await db.select({ id: eventPayments.id })
        .from(eventPayments)
        .where(eq(eventPayments.paymentIntentId, paymentIntentId));
      if (!eventPayment) return;
      await db.insert(paymentRefunds).values({
        eventPaymentId: eventPayment.id,
        stripeRefundId: refund.id,
        requestKey: `stripe:${refund.id}`,
        amountMinor: refund.amount,
        currency: refund.currency,
        status: refund.status ?? "pending",
        reason: refund.reason ?? undefined,
      }).onConflictDoUpdate({
        target: paymentRefunds.stripeRefundId,
        set: { status: refund.status ?? "pending", updatedAt: new Date() },
      });
      const chargeId = expandableId(refund.charge);
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        await db.update(eventPayments).set({
          refundedAmountMinor: charge.amount_refunded,
          status: charge.refunded ? "refunded" : charge.amount_refunded > 0 ? "captured" : undefined,
          refundedAt: charge.amount_refunded > 0 ? new Date() : undefined, updatedAt: new Date(),
        }).where(eq(eventPayments.id, eventPayment.id));
        if (charge.refunded) await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.stripePaymentIntentId, paymentIntentId));
      }
      return;
    }

    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const dispute = event.data.object;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      const [eventPayment] = await db.select({ id: eventPayments.id })
        .from(eventPayments)
        .where(eq(eventPayments.stripeChargeId, chargeId));
      if (!eventPayment) return;
      await db.insert(paymentDisputes).values({
        eventPaymentId: eventPayment.id,
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        amountMinor: dispute.amount,
        currency: dispute.currency,
        status: dispute.status,
        reason: dispute.reason,
        evidenceDueAt: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : undefined,
      }).onConflictDoUpdate({
        target: paymentDisputes.stripeDisputeId,
        set: { status: dispute.status, updatedAt: new Date() },
      });
      return;
    }

    default:
      return;
  }
}

async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (typeof signature !== "string" || !webhookSecret) {
    logger.warn(
      { hasSignature: typeof signature === "string" },
      "Stripe webhook configuration is incomplete",
    );
    return res.status(400).json({ message: "Invalid webhook request" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    logger.warn(
      { errName: safeWebhookError(error) },
      "Stripe webhook signature verification failed",
    );
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const inserted = await db
    .insert(stripeWebhookEvents)
    .values({
      stripeEventId: event.id,
      type: event.type,
      objectId: stripeObjectId(event),
      accountId: event.account ?? null,
      apiVersion: event.api_version ?? null,
      livemode: event.livemode,
      status: "received",
    })
    .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
    .returning({ stripeEventId: stripeWebhookEvents.stripeEventId });

  const leaseExpiredBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await db
    .update(stripeWebhookEvents)
    .set({
      status: "processing",
      ...(inserted.length === 0
        ? { attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1` }
        : {}),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, event.id),
        or(
          inArray(stripeWebhookEvents.status, ["received", "failed"]),
          and(
            eq(stripeWebhookEvents.status, "processing"),
            lt(stripeWebhookEvents.updatedAt, leaseExpiredBefore),
          ),
        ),
      ),
    )
    .returning({ stripeEventId: stripeWebhookEvents.stripeEventId });

  if (claimed.length === 0) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    await processEvent(event);
    await db
      .update(stripeWebhookEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));
    return res.json({ received: true });
  } catch (error) {
    const safeError = safeWebhookError(error);
    await db
      .update(stripeWebhookEvents)
      .set({ status: "failed", lastError: safeError, updatedAt: new Date() })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));
    logger.error(
      { stripeEventId: event.id, eventType: event.type, errName: safeError },
      "Stripe webhook processing failed",
    );
    return res.status(500).json({ message: "Webhook processing failed" });
  }
}

// Express 4 does not automatically forward rejected async handler promises.
// Keep the exported route synchronous and terminate every unexpected failure
// without leaking database or Stripe details to the caller.
export function stripeWebhookHandler(req: Request, res: Response): void {
  void handleStripeWebhook(req, res).catch((error) => {
    logger.error(
      { errName: safeWebhookError(error) },
      "Stripe webhook receipt failed",
    );
    if (!res.headersSent) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
