import type { Request, Response } from "express";
import type Stripe from "stripe";
import { storage } from "../storage";
import { calculatePercentageFeeMinor, decimalToMinorUnits } from "../payments/money";
import { platformFeeBasisPoints, stripe } from "../payments/stripeClient";
import { allocateEvenlyMinor, needsLegacyTransfer } from "../payments/settlement";

interface CollectPaymentRequestBody {
  venueCost?: string;
}

interface Event {
  id: string;
  name: string;
  primaryTeamId: string;
  createdById: string;
  cost: string | null;
  paymentPolicy?: "none" | "fixed_immediate" | "flexible_post_event";
  paymentCollectionInitiated: boolean;
  paymentCollectionInitiatedAt: Date | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueOrganiserId?: string | null;
}

interface Payment {
  id: string;
  userId: string;
  amount: string;
  status: string;
  stripePaymentIntentId?: string | null;
  capturedAmountMinor?: number | null;
  refundedAmountMinor?: number | null;
}

export interface CaptureResult {
  paymentId: string;
  userId: string;
  amount: string;
  status: "captured" | "failed";
  organiserId: string | null;
  error?: string;
}

interface CollectPaymentContext {
  userId: string;
  eventId: string;
  event: Event;
  finalVenueCost: number;
  finalVenueCostMinor: number;
  organiserAccount: string | null;
  authorisedPayments: Payment[];
  attendeeIds: string[];
  organiserId: string;
}

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface AuthenticatedRequest extends Request<{ id: string }, unknown, CollectPaymentRequestBody> {
  userId?: string;
  user?: { claims?: { sub?: string } };
}

export async function validateCollectPaymentRequest(
  req: AuthenticatedRequest
): Promise<CollectPaymentContext> {
  const userId = req.userId ?? req.user?.claims?.sub;
  const eventId = req.params.id;
  const { venueCost } = req.body;

  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const event = await storage.getEvent(eventId) as Event | undefined;
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const userTeam = await storage.getUserTeam(userId, event.primaryTeamId);
  const team = await storage.getTeam(event.primaryTeamId);
  const isEventCreator = event.createdById === userId;

  if (!isEventCreator && (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId))) {
    throw new HttpError(403, "Not authorized to collect payments");
  }

  if (event.paymentCollectionInitiated) {
    throw new HttpError(400, "Payment collection has already been initiated for this event", {
      details: `Payment collection was initiated on ${event.paymentCollectionInitiatedAt?.toLocaleDateString()}`,
    });
  }

  const now = new Date();
  let eventEndTime: Date;
  if (event.endDate && event.endTime) {
    eventEndTime = new Date(`${event.endDate} ${event.endTime}`);
  } else if (event.startDate && event.endTime) {
    eventEndTime = new Date(`${event.startDate} ${event.endTime}`);
  } else {
    eventEndTime = new Date(event.startDate);
    eventEndTime.setHours(23, 59, 59);
  }

  if (eventEndTime >= now) {
    throw new HttpError(400, "Can only collect payments for past events");
  }

  const finalVenueCostMinor = decimalToMinorUnits(venueCost || event.cost || "0");
  if (finalVenueCostMinor <= 0) {
    throw new HttpError(400, "Venue cost must be greater than 0");
  }

  const organiserId = event.venueOrganiserId || event.createdById;

  let organiserAccount: string | null = null;
  if (organiserId) {
    const organiser = await storage.getUserById(organiserId);
    if (!organiser) {
      throw new HttpError(400, "Selected organiser not found");
    }
    if (organiser.stripeAccountId && organiser.payoutsEnabled) {
      organiserAccount = organiser.stripeAccountId;
    }
  }
  if (!organiserAccount) {
    throw new HttpError(409, "The event organiser is not ready to receive Stripe payouts");
  }

  const attendeePayments = await storage.getEventAttendeesWithPayments(eventId);
  const authorisedPayments = attendeePayments.flatMap(({ userId, eventPayment }) => {
    if (
      !eventPayment ||
      eventPayment.status !== "captured" ||
      !eventPayment.paymentIntentId ||
      (!eventPayment.capturedAmountMinor && !eventPayment.holdAmount)
    ) {
      return [];
    }
    return [{
      id: eventPayment.id,
      userId,
      amount: eventPayment.holdAmount,
      status: eventPayment.status,
      stripePaymentIntentId: eventPayment.paymentIntentId,
      capturedAmountMinor: eventPayment.capturedAmountMinor,
      refundedAmountMinor: eventPayment.refundedAmountMinor,
    }];
  });
  const attendance = await storage.getEventAttendance(eventId);
  const attendeeIds = attendance
    .filter(record => ["attending", "promoted"].includes(record.status))
    .map(record => record.userId);

  return {
    userId,
    eventId,
    event,
    finalVenueCost: finalVenueCostMinor / 100,
    finalVenueCostMinor,
    organiserAccount,
    authorisedPayments,
    attendeeIds,
    organiserId,
  };
}

export async function notifyAttendeesMissingAuthorization(
  ctx: CollectPaymentContext
): Promise<{ authorizedPayments: Payment[]; notificationsSent: number }> {
  const { attendeeIds, authorisedPayments, organiserId, userId, event, finalVenueCost, eventId } = ctx;

  if (!attendeeIds || attendeeIds.length === 0) {
    return { authorizedPayments: authorisedPayments, notificationsSent: 0 };
  }

  const attendeesNeedingAuth: string[] = [];
  const authorizedAttendeeIds = authorisedPayments.map(p => p.userId);

  for (const attendeeId of attendeeIds) {
    if (!authorizedAttendeeIds.includes(attendeeId) && attendeeId !== organiserId) {
      attendeesNeedingAuth.push(attendeeId);
    }
  }

  let notificationsSent = 0;
  if (attendeesNeedingAuth.length > 0) {
    const user = await storage.getUserById(userId);
    const amountPerPerson = (finalVenueCost / attendeeIds.length).toFixed(2);
    for (const attendeeId of attendeesNeedingAuth) {
      try {
        await storage.createNotification({
          userId: attendeeId,
          title: "Payment Authorization Required",
          message: `${user?.firstName || 'Event organizer'} has added you to "${event.name}" payment collection. Please authorize £${amountPerPerson} to confirm your attendance.`,
          type: "payment_authorization_required",
          relatedId: eventId,
          metadata: JSON.stringify({
            eventId,
            organizerId: userId,
            amount: amountPerPerson,
            eventName: event.name,
            requiresAuth: true,
          }),
        });
        notificationsSent++;
      } catch (error) {
        console.error(`Failed to send notification to user ${attendeeId}:`, error);
      }
    }
  }

  const authorizedPayments = authorisedPayments.filter(
    p => attendeeIds.includes(p.userId) && p.userId !== organiserId
  );

  return { authorizedPayments, notificationsSent };
}

export async function cancelHoldsAndRequestPayments(
  ctx: CollectPaymentContext,
  amountPerPerson: number
): Promise<number> {
  const { authorisedPayments, attendeeIds, organiserId, userId, event, eventId } = ctx;

  // Cancel existing payment intents and mark payments as cancelled
  for (const payment of authorisedPayments) {
    try {
      if (payment.stripePaymentIntentId) {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      }
    } catch (error) {
      console.error(`Failed to cancel payment intent ${payment.stripePaymentIntentId}:`, error);
    }

    try {
      await storage.updatePaymentStatus(payment.id, "cancelled");
      await storage.updateEventPaymentCancel(eventId, payment.userId, {
        status: "cancelled",
        paymentIntentStatus: "canceled",
      });
    } catch (error) {
      console.error(`Failed to update payment status for ${payment.id}:`, error);
    }
  }

  // Send payment required notifications to all attendees (excluding organiser)
  let notificationsSent = 0;
  if (attendeeIds) {
    const organiser = await storage.getUserById(userId);
    for (const attendeeId of attendeeIds) {
      if (attendeeId === organiserId) continue;
      try {
        await storage.createNotification({
          userId: attendeeId,
          title: "Payment Required",
          message: `${organiser?.firstName || 'Event organizer'} has finalised the cost for "${event.name}". Please pay £${amountPerPerson.toFixed(2)} now.`,
          type: "payment_required",
          relatedId: eventId,
          metadata: JSON.stringify({
            eventId,
            organizerId: userId,
            amount: amountPerPerson.toFixed(2),
            eventName: event.name,
            requiresAuth: false,
          }),
        });
        notificationsSent++;
      } catch (error) {
        console.error(`Failed to send payment required notification to user ${attendeeId}:`, error);
      }
    }
  }

  // Mark event as having initiated payment collection so it can't be retried
  await storage.updateEvent(eventId, {
    finalVenueCost: ctx.finalVenueCost.toString(),
    paymentCollectionInitiated: true,
    paymentCollectionInitiatedAt: new Date(),
    paymentCollectionInitiatedBy: userId,
    paymentStatus: "none",
  });

  return notificationsSent;
}

export async function captureAuthorizedPayments(
  eventId: string,
  authorisedPayments: Payment[],
  captureAmountsMinor: Map<string, number>,
  organiserAccount: string | null,
  organiserId?: string
): Promise<{ captureResults: CaptureResult[]; totalCaptured: number; failedCaptures: number; totalNetAmount: number }> {
  const captureResults: CaptureResult[] = [];
  let totalCaptured = 0;
  let failedCaptures = 0;
  let totalNetAmount = 0;

  for (const payment of authorisedPayments) {
    try {
        if (payment.stripePaymentIntentId) {
          const captureAmountMinor = captureAmountsMinor.get(payment.id);
          if (!captureAmountMinor) {
            throw new Error("Missing server-calculated capture amount");
          }
          const paymentIntent = (await stripe.paymentIntents.capture(
            payment.stripePaymentIntentId,
            {
              amount_to_capture: captureAmountMinor,
              application_fee_amount: calculatePercentageFeeMinor(captureAmountMinor, platformFeeBasisPoints),
            },
            { idempotencyKey: `capture:${payment.id}:${captureAmountMinor}` },
          )) as Stripe.PaymentIntent;

        let transferAmount = 0;
        try {
          const chargeId = paymentIntent.latest_charge as string;
          const charge = await stripe.charges.retrieve(chargeId);
          const balanceTxId = charge.balance_transaction as string;
          const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);

          const amountInPence = balanceTx.amount;
          const stripeFee = balanceTx.fee;
          const platformFee = calculatePercentageFeeMinor(amountInPence, platformFeeBasisPoints);
          transferAmount = Math.max(amountInPence - stripeFee - platformFee, 0);

          // Destination charges allocate funds during capture. Only legacy
          // platform charges without transfer_data need an explicit transfer.
          if (organiserAccount && needsLegacyTransfer(paymentIntent.transfer_data, paymentIntent.status) && transferAmount > 0) {
            try {
              await stripe.transfers.create({
                amount: transferAmount,
                currency: "gbp",
                destination: organiserAccount,
                transfer_group: `event_${eventId}`,
                metadata: {
                  eventId,
                  paymentId: payment.id,
                  userId: payment.userId,
                },
              }, { idempotencyKey: `legacy-transfer:${payment.id}` });
            } catch (transferError) {
              console.error(`Transfer failed for payment ${payment.id}:`, transferError);
            }
          }
        } catch (transferCalcError) {
          console.error(`Transfer calculation failed for payment ${payment.id}:`, transferCalcError);
        }

        totalNetAmount += transferAmount;

        await storage.updateEventPaymentCapture(eventId, payment.userId, {
          status: "captured",
          paymentIntentStatus: paymentIntent.status,
          finalAmount: (captureAmountMinor / 100).toFixed(2),
          capturedAmountMinor: captureAmountMinor,
          platformFeeMinor: calculatePercentageFeeMinor(captureAmountMinor, platformFeeBasisPoints),
          agreedAmountMinor: decimalToMinorUnits(payment.amount),
          currency: "gbp",
          capturedAt: new Date(),
        });

        captureResults.push({
          paymentId: payment.id,
          userId: payment.userId,
          amount: payment.amount,
          status: "captured",
          organiserId: organiserId || null,
        });
        totalCaptured += captureAmountMinor / 100;
      }
    } catch (captureError: unknown) {
      console.error(`Failed to capture payment ${payment.id}:`, captureError);
      captureResults.push({
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        status: "failed",
        error: captureError instanceof Error ? captureError.message : String(captureError),
        organiserId: organiserId || null,
      });
      failedCaptures++;
    }
  }

  return { captureResults, totalCaptured, failedCaptures, totalNetAmount };
}

export async function collectPaymentHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | void> {
  try {
    const ctx = await validateCollectPaymentRequest(req);

    const attendeeIds = ctx.attendeeIds || [];
    const organizerIncluded = attendeeIds.includes(ctx.organiserId || "");
    const chargeableAttendeeIds = attendeeIds
      .filter((attendeeId) => attendeeId !== ctx.organiserId)
      .sort();
    if (chargeableAttendeeIds.length === 0) {
      throw new HttpError(400, "No chargeable attendees were found for this event");
    }

    const amountsDue = allocateEvenlyMinor(ctx.finalVenueCostMinor, chargeableAttendeeIds);
    const paymentsByUser = new Map(ctx.authorisedPayments.map((payment) => [payment.userId, payment]));
    const outstanding: Array<{ userId: string; amountMinor: number; amount: string }> = [];
    const refunds: Array<{ userId: string; amountMinor: number; refundId: string }> = [];
    let availableFundsMinor = 0;
    let totalRefundedMinor = 0;

    for (const attendeeId of chargeableAttendeeIds) {
      const payment = paymentsByUser.get(attendeeId);
      const capturedMinor = payment?.capturedAmountMinor
        ?? (payment?.amount ? decimalToMinorUnits(payment.amount) : 0);
      const alreadyRefundedMinor = payment?.refundedAmountMinor ?? 0;
      const netCollectedMinor = Math.max(capturedMinor - alreadyRefundedMinor, 0);
      const amountDueMinor = ctx.event.paymentPolicy === "fixed_immediate"
        ? netCollectedMinor
        : (amountsDue.get(attendeeId) ?? 0);

      availableFundsMinor += Math.min(netCollectedMinor, amountDueMinor);
      if (!payment?.stripePaymentIntentId || netCollectedMinor < amountDueMinor) {
        const amountMinor = amountDueMinor - netCollectedMinor;
        if (amountMinor > 0) {
          outstanding.push({ userId: attendeeId, amountMinor, amount: (amountMinor / 100).toFixed(2) });
        }
        continue;
      }

      const refundAmountMinor = netCollectedMinor - amountDueMinor;
      if (refundAmountMinor > 0) {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmountMinor,
          reverse_transfer: true,
          // Residual event-cost reconciliation must not refund LUDI's original
          // platform fee. Only reverse the organiser allocation associated with
          // the participant refund.
          refund_application_fee: false,
          metadata: {
            ludiEventId: ctx.eventId,
            ludiParticipantId: attendeeId,
            ludiReason: "event_cost_reconciliation",
          },
        }, { idempotencyKey: `event-refund:${ctx.eventId}:${payment.id}:${refundAmountMinor}` });
        totalRefundedMinor += refundAmountMinor;
        refunds.push({ userId: attendeeId, amountMinor: refundAmountMinor, refundId: refund.id });
        await storage.updateEventPaymentCapture(ctx.eventId, attendeeId, {
          refundedAmountMinor: alreadyRefundedMinor + refundAmountMinor,
          refundAmount: ((alreadyRefundedMinor + refundAmountMinor) / 100).toFixed(2),
          refundedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    await storage.updateEvent(ctx.eventId, {
      finalVenueCost: (ctx.finalVenueCostMinor / 100).toFixed(2),
      paymentCollectionInitiated: true,
      paymentCollectionInitiatedAt: new Date(),
      paymentCollectionInitiatedBy: ctx.userId,
      paymentStatus: outstanding.length === 0 ? "captured" : "partial_captured",
    });

    return res.json({
      message: outstanding.length === 0
        ? "Event payments reconciled and residual balances refunded"
        : "Available funds allocated; additional payment is still required",
      currency: "gbp",
      finalVenueCostMinor: ctx.finalVenueCostMinor,
      availableFundsMinor,
      availableFunds: (availableFundsMinor / 100).toFixed(2),
      totalOutstandingMinor: outstanding.reduce((sum, item) => sum + item.amountMinor, 0),
      totalOutstanding: (outstanding.reduce((sum, item) => sum + item.amountMinor, 0) / 100).toFixed(2),
      amountOwedPerPlayer: outstanding,
      totalRefundedMinor,
      totalRefunded: (totalRefundedMinor / 100).toFixed(2),
      refunds,
      organizerExcluded: organizerIncluded,
    });

  } catch (error) {
    if (error instanceof HttpError) {
      const body: { message: string; details?: string } = { message: error.message };
      if (error.details) {
        body.details = (error.details as { details: string }).details;
      }
      return res.status(error.status).json(body);
    }
    console.error("Error collecting payments:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
