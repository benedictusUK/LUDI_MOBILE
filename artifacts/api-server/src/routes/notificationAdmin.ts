import type { Express, RequestHandler } from "express";
import { and, eq, desc, count, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  platformAdmins, pushTemplates, pushTriggers, pushDevices, pushDeliveries,
  pushAdminAudit, notificationPreferences,
} from "@workspace/db";
import {
  CreatePushTemplateBody, UpdatePushTemplateBody, UpdatePushTriggerBody, PreviewPushTemplateBody,
  SendPushTemplateTestBody, RegisterApplePushDeviceBody, UnregisterApplePushDeviceBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { db } from "../db";
import { apnsConfiguration } from "../notifications/apns";
import { PLACEHOLDERS, TRIGGER_CATALOG, SAMPLE_CONTEXT, renderTemplate, validateTemplateText } from "../notifications/catalog";

class NotificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const handle = (run: (req: any, res: any) => Promise<any>): RequestHandler =>
  (req, res) => { void run(req, res).catch(error => {
    if (error.name === "ZodError") return res.status(400).json({ message: "Invalid notification settings", errors: error.issues || error.errors });
    if (error instanceof NotificationError) return res.status(error.status).json({ message: error.message });
    if (error.code === "23503") return res.status(409).json({ message: "This template is assigned to a trigger. Assign another template first." });
    req.log.error({ errorName: error.name, code: error.code }, "Notification operation failed");
    return res.status(503).json({ message: "Notification settings could not be saved. Please retry." });
  }); };

export async function hasSuperAdminAccess(userId: string) {
  const [role] = await db.select({ userId: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId)).limit(1);
  return !!role;
}
export const requireSuperAdmin: RequestHandler = (req: any, res, next) => {
  void hasSuperAdminAccess(req.userId).then(allowed => {
    if (!allowed) res.status(403).json({ message: "SuperAdmin access is required" });
    else next();
  }).catch(() => { res.status(503).json({ message: "Could not verify platform access" }); });
};

// Session-authenticated mutations must originate from this app, not a site
// exploiting the legacy API's permissive CORS settings. Native JWTs aren't CSRF.
export const sameOriginMutation: RequestHandler = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* Reject invalid origin. */ }
    const hosts = [req.get("host"), req.get("x-forwarded-host"), ...(process.env.REPLIT_DOMAINS || "").split(",")];
    if (!host || !hosts.includes(host)) { res.status(403).json({ message: "Cross-site notification changes are not allowed" }); return; }
  }
  if (req.method !== "DELETE" && !req.is("application/json")) {
    res.status(415).json({ message: "Send notification settings as JSON" }); return;
  }
  next();
};

export function registerNotificationAdmin(app: Express, authenticate: RequestHandler) {
  app.get("/api/admin/access", authenticate, handle(async (req, res) => {
    res.json({ userId: req.userId, isSuperAdmin: await hasSuperAdminAccess(req.userId) });
  }));
  app.use("/api/admin/notifications", authenticate, requireSuperAdmin, sameOriginMutation);

  app.get("/api/admin/notifications", handle(async (req, res) => {
    const [templates, triggers, deliveries, devices, ownDevices] = await Promise.all([
      db.select().from(pushTemplates).orderBy(pushTemplates.name),
      db.select().from(pushTriggers),
      db.select({
        id: pushDeliveries.id, triggerId: pushDeliveries.triggerId, title: pushDeliveries.title,
        status: pushDeliveries.status, attempts: pushDeliveries.attempts, reason: pushDeliveries.reason,
        createdAt: pushDeliveries.createdAt, acceptedAt: pushDeliveries.acceptedAt, environment: pushDevices.environment,
      }).from(pushDeliveries).innerJoin(pushDevices, eq(pushDevices.id, pushDeliveries.deviceId))
        .orderBy(desc(pushDeliveries.createdAt)).limit(60),
      db.select({ count: count() }).from(pushDevices).innerJoin(notificationPreferences, eq(notificationPreferences.userId, pushDevices.userId))
        .where(and(eq(pushDevices.enabled, true), eq(notificationPreferences.pushNotificationsIOS, true))),
      db.select({ count: count() }).from(pushDevices).innerJoin(notificationPreferences, eq(notificationPreferences.userId, pushDevices.userId))
        .where(and(eq(pushDevices.enabled, true), eq(pushDevices.userId, req.userId), eq(notificationPreferences.pushNotificationsIOS, true))),
    ]);
    const config = apnsConfiguration();
    res.json({
      configuration: { configured: config.configured, missing: config.missing, bundleId: config.bundleId,
        deviceCount: devices[0]?.count || 0, ownDeviceCount: ownDevices[0]?.count || 0 },
      templates, triggers: TRIGGER_CATALOG.map(def => ({ ...triggers.find(t => t.id === def.id), ...def })),
      deliveries, placeholders: PLACEHOLDERS,
    });
  }));

  app.post("/api/admin/notifications/templates", handle(async (req, res) => {
    const input = CreatePushTemplateBody.parse(req.body);
    try { validateTemplateText(input.title); validateTemplateText(input.body); }
    catch (error: any) { throw new NotificationError(400, error.message); }
    const template = await db.transaction(async tx => {
      const [created] = await tx.insert(pushTemplates).values(input).returning();
      await tx.insert(pushAdminAudit).values({ actorId: req.userId, action: "template_created", entityId: created.id });
      return created;
    });
    res.status(201).json(template);
  }));
  app.put("/api/admin/notifications/templates/:id", handle(async (req, res) => {
    const input = UpdatePushTemplateBody.parse(req.body);
    try { validateTemplateText(input.title); validateTemplateText(input.body); }
    catch (error: any) { throw new NotificationError(400, error.message); }
    const template = await db.transaction(async tx => {
      const [updated] = await tx.update(pushTemplates).set({ ...input, updatedAt: new Date() }).where(eq(pushTemplates.id, req.params.id)).returning();
      if (!updated) throw new NotificationError(404, "Template not found");
      await tx.insert(pushAdminAudit).values({ actorId: req.userId, action: "template_updated", entityId: updated.id });
      return updated;
    });
    res.json(template);
  }));
  app.delete("/api/admin/notifications/templates/:id", handle(async (req, res) => {
    await db.transaction(async tx => {
      const [used] = await tx.select().from(pushTriggers).where(eq(pushTriggers.templateId, req.params.id)).limit(1);
      if (used) throw new NotificationError(409, "This template is assigned to a trigger. Assign another template first.");
      const deleted = await tx.delete(pushTemplates).where(eq(pushTemplates.id, req.params.id)).returning();
      if (!deleted.length) throw new NotificationError(404, "Template not found");
      await tx.insert(pushAdminAudit).values({ actorId: req.userId, action: "template_deleted", entityId: req.params.id });
    });
    res.status(204).end();
  }));
  app.put("/api/admin/notifications/triggers/:id", handle(async (req, res) => {
    const input = UpdatePushTriggerBody.parse(req.body);
    const definition = TRIGGER_CATALOG.find(t => t.id === req.params.id);
    if (!definition) throw new NotificationError(404, "Unsupported notification trigger");
    if (!(definition.allowedAudiences as readonly string[]).includes(input.audience)) throw new NotificationError(400, "That recipient audience is not supported for this trigger");
    const [template] = await db.select().from(pushTemplates).where(eq(pushTemplates.id, input.templateId));
    if (!template) throw new NotificationError(400, "Choose an existing template");
    const trigger = await db.transaction(async tx => {
      const [updated] = await tx.update(pushTriggers).set({ ...input, updatedAt: new Date() }).where(eq(pushTriggers.id, definition.id)).returning();
      if (!updated) throw new NotificationError(404, "Trigger not found");
      await tx.insert(pushAdminAudit).values({ actorId: req.userId, action: "trigger_updated", entityId: updated.id });
      return updated;
    });
    res.json({ ...trigger, ...definition });
  }));
  app.post("/api/admin/notifications/preview", handle(async (req, res) => {
    const input = PreviewPushTemplateBody.parse(req.body);
    try { res.json({ title: renderTemplate(input.title, SAMPLE_CONTEXT), body: renderTemplate(input.body, SAMPLE_CONTEXT) }); }
    catch (error: any) { throw new NotificationError(400, error.message); }
  }));
  app.post("/api/admin/notifications/test", handle(async (req, res) => {
    const input = SendPushTemplateTestBody.parse(req.body);
    const [template] = await db.select().from(pushTemplates).where(eq(pushTemplates.id, input.templateId));
    if (!template) throw new NotificationError(404, "Template not found");
    const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, req.userId));
    const devices = await db.select().from(pushDevices).where(and(eq(pushDevices.userId, req.userId), eq(pushDevices.enabled, true)));
    if (!pref?.pushNotificationsIOS || !devices.length) throw new NotificationError(409, "Enable iPhone push notifications in LUDI Settings on a signed build first.");
    if (devices.some(d => !apnsConfiguration(d.environment).configured)) throw new NotificationError(503, "Apple APNs credentials are not configured for your device environment");
    const recent = await db.select({ count: count() }).from(pushDeliveries).where(and(
      eq(pushDeliveries.userId, req.userId), eq(pushDeliveries.triggerId, "test"),
      sql`${pushDeliveries.createdAt} > now() - interval '1 minute'`,
    ));
    if (recent[0].count >= 10) throw new NotificationError(429, "Wait a minute before sending another test");
    const key = randomUUID();
    const queued = await db.transaction(async tx => {
      const rows = await tx.insert(pushDeliveries).values(devices.map(device => ({
        deviceId: device.id, userId: req.userId, triggerId: "test", dedupeKey: `test:${key}:${device.id}`,
        title: renderTemplate(template.title, SAMPLE_CONTEXT), body: renderTemplate(template.body, SAMPLE_CONTEXT),
        data: { triggerId: "test", userId: req.userId }, expiresAt: new Date(Date.now() + 5 * 60_000),
      }))).returning({ id: pushDeliveries.id });
      await tx.insert(pushAdminAudit).values({ actorId: req.userId, action: "test_queued", entityId: template.id });
      return rows.length;
    });
    res.status(202).json({ queued });
  }));

  app.post("/api/push/devices", authenticate, sameOriginMutation, handle(async (req, res) => {
    const input = RegisterApplePushDeviceBody.parse(req.body);
    await db.transaction(async tx => {
      await tx.update(pushDevices).set({ enabled: false, updatedAt: new Date() }).where(and(
        eq(pushDevices.userId, req.userId), eq(pushDevices.installationId, input.installationId),
      ));
      await tx.insert(pushDevices).values({ ...input, token: input.token.toLowerCase(), userId: req.userId })
        .onConflictDoUpdate({ target: [pushDevices.token, pushDevices.environment],
          set: { userId: req.userId, installationId: input.installationId, enabled: true, updatedAt: new Date() } });
    });
    res.json({ registered: true });
  }));
  app.delete("/api/push/devices", authenticate, sameOriginMutation, handle(async (req, res) => {
    const input = UnregisterApplePushDeviceBody.parse(req.body);
    await db.update(pushDevices).set({ enabled: false, updatedAt: new Date() }).where(and(
      eq(pushDevices.userId, req.userId), eq(pushDevices.installationId, input.installationId),
    ));
    res.status(204).end();
  }));

  const preferenceInput = z.object({
    newEvents: z.boolean().optional(), paymentReminders: z.boolean().optional(), eventChanges: z.boolean().optional(),
    votingOpportunities: z.boolean().optional(), flareGunReminders: z.boolean().optional(), teamInvites: z.boolean().optional(),
    pushNotificationsIOS: z.boolean().optional(), pushNotificationsAndroid: z.boolean().optional(),
  });
  app.get("/api/notification-preferences", authenticate, handle(async (req, res) => {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, req.userId));
    res.json(prefs || { newEvents: true, paymentReminders: true, eventChanges: true, votingOpportunities: false,
      flareGunReminders: false, teamInvites: true, pushNotificationsIOS: false, pushNotificationsAndroid: false });
  }));
  app.put("/api/notification-preferences", authenticate, sameOriginMutation, handle(async (req, res) => {
    // Existing web settings wraps its payload in a body string; accept that
    // legacy shape while native clients send the direct JSON object.
    let body = req.body;
    if (typeof body.body === "string") { try { body = JSON.parse(body.body); } catch { throw new NotificationError(400, "Invalid notification preferences"); } }
    const input = preferenceInput.parse(body);
    const [prefs] = await db.insert(notificationPreferences).values({ ...input, userId: req.userId })
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...input, updatedAt: new Date() } }).returning();
    res.json(prefs);
  }));
  // An ordinary client cannot turn the old arbitrary notification-creation
  // endpoint into a platform-wide push broadcaster.
  app.post("/api/notifications", authenticate, (_req, res) => {
    res.status(403).json({ message: "Notifications are generated by supported platform actions" });
  });
}