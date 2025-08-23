import type { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../storage";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

interface CollectPaymentRequestBody {
  organiserId?: string;
  venueCost?: string;
  attendeeIds?: string[];
}

interface Event {
  id: string;
  name: string;
  primaryTeamId: string;
  createdById: string;
  cost: string | null;
  paymentCollectionInitiated: boolean;
  paymentCollectionInitiatedAt: Date | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

interface Payment {
  id: string;
  userId: string;
  amount: string;
  status: string;
  stripePaymentIntentId?: string | null;
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
  organiserAccount: string | null;
  authorisedPayments: Payment[];
  attendeeIds?: string[];
  organiserId?: string;
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
  user?: { claims?: { sub?: string } };
}

export async function validateCollectPaymentRequest(
  req: AuthenticatedRequest
): Promise<CollectPaymentContext> {
  const userId = req.user?.claims?.sub;
  const eventId = req.params.id;
  const { organiserId, venueCost, attendeeIds } = req.body;

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

  const finalVenueCost = venueCost ? parseFloat(venueCost) : parseFloat(event.cost || "0");
  if (finalVenueCost <= 0) {
    throw new HttpError(400, "Venue cost must be greater than 0");
  }

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

  const payments = await storage.getEventPayments(eventId);
  const authorisedPayments = payments.filter(p => p.status === "hold_created") as Payment[];

  return {
    userId,
    eventId,
    event,
    finalVenueCost,
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
    finalVenueCost: ctx.finalVenueCost,
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
  organiserAccount: string | null,
  organiserId?: string
): Promise<{ captureResults: CaptureResult[]; totalCaptured: number; failedCaptures: number }> {
  const captureResults: CaptureResult[] = [];
  let totalCaptured = 0;
  let failedCaptures = 0;

  for (const payment of authorisedPayments) {
    try {
      if (payment.stripePaymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.capture(
          payment.stripePaymentIntentId,
          {}
        );

        if (organiserAccount && paymentIntent.status === "succeeded") {
          try {
            const amountInPence = Math.round(parseFloat(payment.amount) * 100);
            const transferAmount = Math.round(amountInPence * 0.95);

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
            });
          } catch (transferError) {
            console.error(`Transfer failed for payment ${payment.id}:`, transferError);
          }
        }

        await storage.updatePaymentStatus(payment.id, "captured");

        captureResults.push({
          paymentId: payment.id,
          userId: payment.userId,
          amount: payment.amount,
          status: "captured",
          organiserId: organiserId || null,
        });
        totalCaptured += parseFloat(payment.amount);
      }
    } catch (captureError: unknown) {
      console.error(`Failed to capture payment ${payment.id}:`, captureError);
      await storage.updatePaymentStatus(payment.id, "failed");
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

  return { captureResults, totalCaptured, failedCaptures };
}

export async function collectPaymentHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | void> {
  try {
    const ctx = await validateCollectPaymentRequest(req);

    const attendeeIds = ctx.attendeeIds || [];
    const organizerIncluded = attendeeIds.includes(ctx.organiserId || "");
    const payingAttendeeCount = organizerIncluded ? attendeeIds.length - 1 : attendeeIds.length;

    const authorizedPaymentsForAttendees = ctx.authorisedPayments.filter(
      p => attendeeIds.includes(p.userId) && p.userId !== ctx.organiserId
    );
    const holdAmount = authorizedPaymentsForAttendees.length > 0 ? parseFloat(authorizedPaymentsForAttendees[0].amount) : 0;
    const amountPerPerson = payingAttendeeCount > 0 ? ctx.finalVenueCost / payingAttendeeCount : 0;

    if (authorizedPaymentsForAttendees.length > 0 && amountPerPerson > holdAmount) {
      const notificationsSent = await cancelHoldsAndRequestPayments({ ...ctx, authorisedPayments: authorizedPaymentsForAttendees }, amountPerPerson);
      return res.status(200).json({
        message: "Final cost exceeds authorized amount. Holds cancelled and payment requests sent to attendees.",
        notificationsSent,
        totalAmount: 0,
        successfulCaptures: 0,
        failedCaptures: 0,
        organizerExcluded: organizerIncluded,
      });
    }

    const notificationResult = await notifyAttendeesMissingAuthorization(ctx);
    const authorizedPayments = notificationResult.authorizedPayments;
    const notificationsSent = notificationResult.notificationsSent;

    if (authorizedPayments.length === 0) {
      const message = ctx.attendeeIds && ctx.attendeeIds.length > 0
        ? `Payment authorization notifications sent to ${notificationsSent} attendees${organizerIncluded ? ' (venue organizer excluded from payments)' : ''}. No payments to capture at this time.`
        : "No authorized payments found for this event";

      return res.status(200).json({
        message,
        notificationsSent,
        totalAmount: 0,
        successfulCaptures: 0,
        failedCaptures: 0,
        organizerExcluded: organizerIncluded || false,
      });
    }

    const { captureResults, totalCaptured, failedCaptures } = await captureAuthorizedPayments(
      ctx.eventId,
      authorizedPayments,
      ctx.organiserAccount,
      ctx.organiserId
    );

    await storage.updateEvent(ctx.eventId, {
      paymentCollectionInitiated: true,
      paymentCollectionInitiatedAt: new Date(),
      paymentCollectionInitiatedBy: ctx.userId,
      paymentStatus: failedCaptures === 0 ? "captured" : "partial_captured",
    });

    const totalSelectedAttendees = ctx.attendeeIds ? ctx.attendeeIds.length : 0;

    return res.json({
      message: `Payment collection completed${organizerIncluded ? ' (venue organizer excluded from charges)' : ''}`,
      totalPayments: authorizedPayments.length,
      totalSelectedAttendees,
      successfulCaptures: authorizedPayments.length - failedCaptures,
      failedCaptures,
      totalAmount: totalCaptured.toFixed(2),
      venueCost: ctx.finalVenueCost.toFixed(2),
      organiserConnectEnabled: !!ctx.organiserAccount,
      organizerExcluded: organizerIncluded || false,
      results: captureResults,
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

