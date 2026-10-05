import type { Express, RequestHandler } from "express";
import { and, eq, notInArray } from "drizzle-orm";
import {
  events, eventPayments, eventTeams, payments, insertEventSchema, teamMemberships, notifications, notificationPreferences,
  normalizeEventPaymentSettings, paymentWindow, effectivePaymentPolicy,
} from "@workspace/db";
import { db } from "../db";
import { storage } from "../storage";
import { stripe } from "../payments/stripeClient";
import {
  PaymentPolicyError, requireEventAccess, getPolicyQuote, hasValidEventPayment,
  getOrCreateEventIntent, finalizeEventIntent, refundRegistration, usesUpfrontRefunds,
} from "../payments/policyService";
import { getFeeSettings } from "../payments/feeSettings";
import { settleFlexibleEvent } from "../payments/flexibleRefunds";

const handler = (run: (req: any, res: any, next: any) => Promise<any>): RequestHandler =>
  (req, res, next) => { void run(req, res, next).catch(error => {
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid event payment settings", errors: error.issues || error.errors });
    } else if (error instanceof PaymentPolicyError) {
      res.status(error.status).json({ message: error.message });
    } else {
      console.error("Event payment operation failed", error.name, error.code || "");
      res.status(error.type === "StripeCardError" ? 402 : 503).json({
        message: error.type === "StripeCardError" ? "Your card could not complete the payment. Please try another card." : "The payment operation could not complete. Please retry; do not start a second payment.",
      });
    }
  }); };

async function canManage(event: typeof events.$inferSelect, userId: string) {
  const [membership, team] = await Promise.all([
    storage.getUserTeam(userId, event.primaryTeamId), storage.getTeam(event.primaryTeamId),
  ]);
  return event.createdById === userId || team?.ownerId === userId || !!membership && ["admin", "captain"].includes(membership.role);
}

const financialFields = [
  "paymentRequired", "paymentPolicy", "currency", "fixedPriceMinor", "minimumPaidParticipants",
  "paymentDeadlineAt", "authorizationOpensAt", "completionDueAt", "maxPlayerPayment",
  "venueOrganiserId", "startDate", "startTime", "endDate", "endTime", "primaryTeamId",
] as const;

export function registerEventPaymentPolicies(app: Express, authenticate: RequestHandler) {
  app.post("/api/events", authenticate, handler(async (req, _res, next) => {
    const teamId = req.body.primaryTeamId || req.body.teamId;
    if (typeof teamId !== "string") throw new PaymentPolicyError(400, "Primary team ID is required");
    const [membership, team] = await Promise.all([storage.getUserTeam(req.userId, teamId), storage.getTeam(teamId)]);
    if (!membership && team?.ownerId !== req.userId) throw new PaymentPolicyError(403, "You must belong to the event's primary team");
    req.body.feeConfiguration = await getFeeSettings();
    req.body = normalizeEventPaymentSettings(req.body);
    req.body.paymentStatus = "none";
    req.body.paymentCollectionInitiated = false;
    delete req.body.paymentCollectionInitiatedAt;
    delete req.body.paymentCollectionInitiatedBy;
    if (req.body.paymentRequired && paymentWindow(req.body).deadline <= new Date()) throw new PaymentPolicyError(400, "New paid events need a future payment deadline");
    // Validate the actual form payload here, so malformed optional fields cannot
    // reach the legacy Express handler as an uncaught schema error.
    req.body = insertEventSchema.parse({ ...req.body, createdById: req.userId, primaryTeamId: teamId });
    next();
  }));

  const updateEvent = handler(async (req, res) => {
    const result = await db.transaction(async tx => {
      const [existing] = await tx.select().from(events).where(eq(events.id, req.params.id)).for("update");
      if (!existing) throw new PaymentPolicyError(404, "Event not found");
      if (!await canManage(existing, req.userId)) throw new PaymentPolicyError(403, "You are not authorised to edit this event");
      const input = { ...req.body };
      delete input.feeConfiguration;
      const normalized = normalizeEventPaymentSettings(input, existing);
      delete (normalized as Record<string, unknown>).feeConfiguration;
      const data = insertEventSchema.partial().parse(normalized);
      // Zod transforms/defaults may emit values for absent optional inputs.
      // A partial update must never clear unrelated event times or team links.
      for (const field of Object.keys(data)) if (!(field in normalized)) delete (data as any)[field];
      // Identity and financial progress cannot be edited through the event form.
      delete data.createdById;
      delete data.paymentStatus;
      delete data.paymentCollectionInitiated;
      delete data.paymentCollectionInitiatedAt;
      delete data.paymentCollectionInitiatedBy;
      const [financialRecord] = await tx.select().from(eventPayments).where(eq(eventPayments.eventId, existing.id)).limit(1);
      const [legacyRecord] = await tx.select().from(payments).where(eq(payments.eventId, existing.id)).limit(1);
      if (financialRecord || legacyRecord) {
        const previous = normalizeEventPaymentSettings({}, existing) as any;
        for (const field of financialFields) {
          if (!(field in data)) continue;
          const before = previous[field] ?? (existing as any)[field] ?? null;
          const after = (data as any)[field] ?? null;
          const key = (value: any) => value instanceof Date ? value.toISOString() : value;
          if (key(before) !== key(after)) throw new PaymentPolicyError(409, "Payment terms and event times cannot change after checkout has started. Create a new event instead.");
        }
      }
      if (data.primaryTeamId && data.primaryTeamId !== existing.primaryTeamId) {
        const membership = await storage.getUserTeam(req.userId, data.primaryTeamId);
        const team = await storage.getTeam(data.primaryTeamId);
        if (!membership && team?.ownerId !== req.userId) throw new PaymentPolicyError(403, "You must belong to the destination team");
      }
      const [updated] = await tx.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, existing.id)).returning();
      if (data.secondaryTeamIds !== undefined) {
        const wanted = [...new Set([updated.primaryTeamId, ...data.secondaryTeamIds])];
        const oldLinks = await tx.select().from(eventTeams).where(eq(eventTeams.eventId, existing.id));
        await tx.delete(eventTeams).where(and(eq(eventTeams.eventId, existing.id), notInArray(eventTeams.teamId, wanted)));
        const additions = wanted.filter(teamId => !oldLinks.some(link => link.teamId === teamId));
        if (additions.length) await tx.insert(eventTeams).values(additions.map(teamId => ({
          eventId: existing.id, teamId, status: teamId === updated.primaryTeamId ? "accepted" : "invited",
        })));
      }
      const members = await tx.select({ userId: teamMemberships.userId, eventChanges: notificationPreferences.eventChanges }).from(teamMemberships)
        .leftJoin(notificationPreferences, eq(notificationPreferences.userId, teamMemberships.userId))
        .where(eq(teamMemberships.teamId, updated.primaryTeamId));
      const recipients = members.filter(m => m.userId !== req.userId && m.eventChanges !== false);
      if (recipients.length) await tx.insert(notifications).values(recipients.map(member => ({
        userId: member.userId, title: "Event updated", message: `The details for "${updated.name}" have changed.`,
        type: "event_changed", relatedId: updated.id,
        metadata: JSON.stringify({ eventId: updated.id }),
      })));
      return updated;
    });
    res.json(result);
  });
  app.put("/api/events/:id", authenticate, updateEvent);
  app.patch("/api/events/:id", authenticate, updateEvent);
  app.delete("/api/events/:id", authenticate, handler(async (req, res) => {
    const event = await requireEventAccess(req.params.id, req.userId);
    if (!await canManage(event, req.userId)) throw new PaymentPolicyError(403, "You are not authorised to delete this event");
    await db.transaction(async tx => {
      // Checkout also locks this event: cancellation cannot race a new payment.
      await tx.select({ id: events.id }).from(events).where(eq(events.id, event.id)).for("update");
      const modern = await tx.select({ id: eventPayments.id }).from(eventPayments).where(eq(eventPayments.eventId, event.id)).limit(1);
      const legacy = await tx.select({ id: payments.id }).from(payments).where(eq(payments.eventId, event.id)).limit(1);
      if (legacy.length || modern.length) throw new PaymentPolicyError(409, "Events with checkout or payment records must be retained for audit. Cancel registrations instead.");
      const members = await tx.select({ userId: teamMemberships.userId, eventChanges: notificationPreferences.eventChanges }).from(teamMemberships)
        .leftJoin(notificationPreferences, eq(notificationPreferences.userId, teamMemberships.userId))
        .where(eq(teamMemberships.teamId, event.primaryTeamId));
      const recipients = members.filter(m => m.userId !== req.userId && m.eventChanges !== false);
      if (recipients.length) await tx.insert(notifications).values(recipients.map(member => ({
        userId: member.userId, title: "Event cancelled", message: `"${event.name}" has been cancelled.`,
        type: "event_cancelled", relatedId: event.id,
        metadata: JSON.stringify({ eventId: event.id, eventData: { title: event.name, startDate: event.startDate, startTime: event.startTime, location: event.location } }),
      })));
      await tx.delete(events).where(eq(events.id, event.id));
    });
    res.json({ message: "Event deleted successfully" });
  }));

  app.get("/api/events/:id/payment-policy", authenticate, handler(async (req, res) => {
    const event = await requireEventAccess(req.params.id, req.userId);
    res.json(await getPolicyQuote(event, req.userId, typeof req.query.notificationId === "string" ? req.query.notificationId : undefined));
  }));
  app.post("/api/events/:id/collect-payment", authenticate, handler(async (req, res, next) => {
    const event = await requireEventAccess(req.params.id, req.userId);
    if (!usesUpfrontRefunds(event)) return next();
    if (!await canManage(event, req.userId)) throw new PaymentPolicyError(403, "You are not authorised to finalise this event");
    const result = await settleFlexibleEvent(event, req.userId, req.body.venueCost);
    res.status(result.settlementComplete ? 200 : 202).json(result);
  }));
  app.post("/api/payments/create-intent", authenticate, handler(async (req, res) => {
    if (typeof req.body.eventId !== "string") throw new PaymentPolicyError(400, "Event ID is required");
    const event = await requireEventAccess(req.body.eventId, req.userId);
    const { intent } = await getOrCreateEventIntent(event, req.userId, typeof req.body.notificationId === "string" ? req.body.notificationId : undefined);
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: intent.amount,
      currency: intent.currency, paymentPolicy: effectivePaymentPolicy(event), captureMethod: intent.capture_method });
  }));
  const authorize = handler(async (req, res) => {
    const notificationId = req.params.notificationId;
    const notification = notificationId ? await storage.getNotificationById(notificationId) : undefined;
    let eventId = req.params.id;
    if (notificationId) {
      if (!notification || notification.userId !== req.userId) throw new PaymentPolicyError(403, "This payment request does not belong to you");
      try { eventId = JSON.parse(notification.metadata || "{}").eventId; } catch { throw new PaymentPolicyError(400, "Invalid payment request"); }
    }
    const event = await requireEventAccess(eventId, req.userId);
    if (req.body.paymentIntentId && req.body.paymentMethod === "wallet") {
      const result = await finalizeEventIntent(event, req.userId, req.body.paymentIntentId);
      res.status(result.success ? 200 : 409).json(result);
      return;
    }
    if (typeof req.body.paymentMethodId !== "string") throw new PaymentPolicyError(400, "Payment method ID is required");
    const { intent, customerId } = await getOrCreateEventIntent(event, req.userId, notificationId);
    if (["succeeded", "requires_capture"].includes(intent.status)) {
      const result = await finalizeEventIntent(event, req.userId, intent.id);
      res.status(result.success ? 200 : 409).json(result);
      return;
    }
    const method = await stripe.paymentMethods.retrieve(req.body.paymentMethodId);
    const customer = typeof method.customer === "string" ? method.customer : method.customer?.id;
    if (method.type !== "card" || customer !== customerId) throw new PaymentPolicyError(403, "This card does not belong to the authenticated participant");
    try {
      await stripe.paymentIntents.confirm(intent.id, {
        // This endpoint is called by a participant actively checking out.
        // off_session=true rejects 3DS-required cards instead of returning
        // the authentication action that the web/native Stripe SDK can handle.
        payment_method: method.id, use_stripe_sdk: true,
      }, { idempotencyKey: `confirm-event:${intent.id}:${method.id}` });
    } catch (error: any) {
      const current = await stripe.paymentIntents.retrieve(intent.id);
      if (current.status !== "requires_action") throw error;
    }
    const result = await finalizeEventIntent(event, req.userId, intent.id);
    res.status(result.success ? 200 : 409).json(result);
  });
  app.post("/api/events/:id/authorize-payment", authenticate, authorize);
  app.post("/api/notifications/:notificationId/authorize-payment", authenticate, authorize);

  const paymentStatus = handler(async (req, res) => {
    const event = await requireEventAccess(req.params.id || req.params.eventId, req.userId);
    const row = await storage.getEventPayment(event.id, req.userId);
    const valid = await hasValidEventPayment(event, req.userId);
    res.json({
      hasAuthorization: valid, status: row?.status || "none", paymentRecord: row ?? null,
      setupComplete: !!row?.paymentMethodId, holdCreated: valid,
      captured: valid && row?.status === "captured",
      ...await getPolicyQuote(event, req.userId),
    });
  });
  app.get("/api/events/:id/payment-status", authenticate, paymentStatus);
  app.get("/api/payments/event/:eventId/status", authenticate, paymentStatus);

  const cancel = handler(async (req, res) => {
    const event = await requireEventAccess(req.params.id, req.userId);
    if (effectivePaymentPolicy(event) !== "flexible_post_event" && new Date() >= paymentWindow(event).deadline) {
      throw new PaymentPolicyError(409, "The paid-registration withdrawal deadline has passed");
    }
    const result = await refundRegistration(event, req.userId, "participant_withdrawal");
    if (result?.status === "failed" || result?.status === "canceled") throw new PaymentPolicyError(502, "The refund could not complete. Your registration has not been withdrawn.");
    await storage.voteOnEvent(event.id, req.userId, "not_attending");
    res.json({ success: true, message: result ? "Your refund has been submitted" : "Your authorization has been released", refund: result });
  });
  app.post("/api/events/:id/cancel-payment", authenticate, cancel);
  const vote = handler(async (req, res) => {
    if (!["attending", "not_attending", "pending", "maybe"].includes(req.body.status)) throw new PaymentPolicyError(400, "Invalid attendance status");
    const event = await requireEventAccess(req.params.id, req.userId);
    const organiser = req.userId === (event.venueOrganiserId || event.createdById);
    if (req.body.status === "attending" && event.paymentRequired && !organiser && !await hasValidEventPayment(event, req.userId)) {
      throw new PaymentPolicyError(402, "Complete the event payment before confirming attendance");
    }
    let refund;
    if (req.body.status !== "attending" && event.paymentRequired && !organiser) {
      const row = await storage.getEventPayment(event.id, req.userId);
      if (row?.paymentIntentId) {
        if (effectivePaymentPolicy(event) !== "flexible_post_event" && row.capturedAmountMinor && new Date() >= paymentWindow(event).deadline) throw new PaymentPolicyError(409, "The paid-registration withdrawal deadline has passed");
         if (effectivePaymentPolicy(event) === "flexible_post_event" && !usesUpfrontRefunds(event) && row.status === "captured") throw new PaymentPolicyError(409, "This event has already settled. Contact the organiser about refunds.");
        const result = await refundRegistration(event, req.userId, "participant_withdrawal");
        if (result?.status === "failed" || result?.status === "canceled") throw new PaymentPolicyError(502, "The refund could not complete. Your registration has not been withdrawn.");
        refund = result;
      }
    }
    const result = await storage.voteOnEvent(event.id, req.userId, req.body.status);
    res.json({ ...result, message: refund ? "Your refund has been submitted" : "Attendance updated successfully", refundStatus: refund?.status });
  });
  app.post("/api/events/:id/vote", authenticate, vote);
  app.post("/api/events/:id/attendance", authenticate, vote);
  app.delete("/api/events/:id/vote", authenticate, handler(async (req, res) => {
    const event = await requireEventAccess(req.params.id, req.userId);
    let refund;
    if (event.paymentRequired && req.userId !== (event.venueOrganiserId || event.createdById)) {
      const row = await storage.getEventPayment(event.id, req.userId);
      if (row?.paymentIntentId) {
        if (effectivePaymentPolicy(event) !== "flexible_post_event" && row.capturedAmountMinor && new Date() >= paymentWindow(event).deadline) throw new PaymentPolicyError(409, "The paid-registration withdrawal deadline has passed");
        if (effectivePaymentPolicy(event) === "flexible_post_event" && !usesUpfrontRefunds(event) && row.status === "captured") throw new PaymentPolicyError(409, "This event has already settled. Contact the organiser about refunds.");
        refund = await refundRegistration(event, req.userId, "participant_withdrawal");
        if (refund?.status === "failed" || refund?.status === "canceled") throw new PaymentPolicyError(502, "The refund could not complete. Your vote has not been removed.");
      }
    }
    await storage.removeVote(event.id, req.userId);
    res.json({ success: true, message: refund ? "Vote removed and your refund has been submitted" : "Vote removed and any authorization released", refundStatus: refund?.status });
  }));

  // Older callers must not bypass policy/currency/window validation using an
  // unrelated setup/hold endpoint that trusts a client-supplied amount.
  app.post("/api/payments/create-hold", authenticate, (_req, res) =>
    res.status(410).json({ message: "Use the event payment checkout to authorize payments" }));
}