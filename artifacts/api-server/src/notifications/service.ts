import { and, or, eq, inArray, lte, gte } from "drizzle-orm";
import {
  notifications, events, teams, eventAttendance, teamMemberships, notificationPreferences,
  eventPayments, pushTemplates, pushTriggers, pushDevices, pushDeliveries,
  pushNotificationOutbox, pushReminderClaims, paymentWindow,
} from "@workspace/db";
import { db } from "../db";
import { logger } from "../lib/logger";
import { notificationWS } from "../websocket";
import { canonicalTrigger, pushPreferenceAllows, renderTemplate, type TemplateContext } from "./catalog";
import { apnsConfiguration, classifyApnsResponse, sendApplePush } from "./apns";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Notification = typeof notifications.$inferSelect;

function metadataOf(notification: Notification): Record<string, any> {
  try { const value = JSON.parse(notification.metadata || "{}"); return value && typeof value === "object" ? value : {}; }
  catch { return {}; }
}
export async function notificationContext(notification: Notification, tx: Pick<typeof db, "select"> = db) {
  const metadata = metadataOf(notification);
  const eventId = metadata.eventId || metadata.eventData?.id || notification.relatedId;
  const [event] = typeof eventId === "string"
    ? await tx.select().from(events).where(eq(events.id, eventId)).limit(1) : [];
  const [team] = event ? await tx.select().from(teams).where(eq(teams.id, event.primaryTeamId)).limit(1) : [];
  const context: TemplateContext = {
    eventName: event?.name || metadata.eventData?.title || metadata.eventName || "your event",
    teamName: team?.name || metadata.eventData?.primaryTeamName || metadata.teamName || "your team",
    startTime: event?.startTime || metadata.eventData?.startTime || "the scheduled time",
    startDate: String(event?.startDate || metadata.eventData?.startDate || "the scheduled date"),
    location: event?.location || metadata.eventData?.location || "the event location",
    amount: typeof metadata.amountMinor === "number" ? `£${(metadata.amountMinor / 100).toFixed(2)}` : "the agreed amount",
    message: notification.message,
  };
  // Untrusted metadata must not become objects or recursive template values.
  for (const key of Object.keys(context) as (keyof TemplateContext)[]) context[key] = String(context[key]);
  return { context, event, eventId: event?.id || (typeof eventId === "string" ? eventId : undefined) };
}

async function queueNotification(tx: Transaction, notification: Notification) {
  const triggerId = canonicalTrigger(notification.type);
  if (!triggerId) return;
  const [trigger] = await tx.select().from(pushTriggers).where(eq(pushTriggers.id, triggerId)).limit(1);
  if (!trigger?.enabled) return;
  const [prefs] = await tx.select().from(notificationPreferences).where(eq(notificationPreferences.userId, notification.userId)).limit(1);
  if (!pushPreferenceAllows(triggerId, prefs)) return;
  const { context, event, eventId } = await notificationContext(notification, tx);
  if (trigger.audience === "attendees") {
    if (!event) return;
    const [attendance] = await tx.select().from(eventAttendance).where(and(
      eq(eventAttendance.eventId, event.id), eq(eventAttendance.userId, notification.userId),
      inArray(eventAttendance.status, ["attending", "promoted"]),
    )).limit(1);
    if (!attendance) return;
  }
  const [template] = await tx.select().from(pushTemplates).where(eq(pushTemplates.id, trigger.templateId)).limit(1);
  if (!template) return;
  const devices = await tx.select().from(pushDevices).where(and(eq(pushDevices.userId, notification.userId), eq(pushDevices.enabled, true)));
  if (!devices.length) return;
  const created = notification.createdAt || new Date();
  const expiresAt = new Date(+created + 6 * 3600_000);
  if (expiresAt <= new Date()) return;
  const title = renderTemplate(template.title, context);
  const body = renderTemplate(template.body, context);
  const data: Record<string, string> = { notificationId: notification.id, triggerId, userId: notification.userId };
  if (eventId) data.eventId = eventId;
  await tx.insert(pushDeliveries).values(devices.map(device => ({
    userId: notification.userId, deviceId: device.id, notificationId: notification.id, triggerId,
    dedupeKey: `${notification.id}:${device.id}`, title, body, data, expiresAt,
  }))).onConflictDoNothing({ target: pushDeliveries.dedupeKey });
}

export async function processNotificationOutbox() {
  await db.transaction(async tx => {
    const batch = await tx.select().from(pushNotificationOutbox).orderBy(pushNotificationOutbox.createdAt)
      .limit(30).for("update", { skipLocked: true });
    for (const entry of batch) {
      const [notification] = await tx.select().from(notifications).where(eq(notifications.id, entry.notificationId)).limit(1);
      if (notification) await queueNotification(tx, notification);
      await tx.delete(pushNotificationOutbox).where(eq(pushNotificationOutbox.notificationId, entry.notificationId));
    }
  });
}

export async function processPushDeliveries() {
  const batch = await db.transaction(async tx => {
    const now = new Date();
    const rows = await tx.select().from(pushDeliveries).where(and(
      inArray(pushDeliveries.status, ["queued", "retry", "sending"]), lte(pushDeliveries.nextAttemptAt, now),
    )).orderBy(pushDeliveries.nextAttemptAt).limit(10).for("update", { skipLocked: true });
    if (rows.length) await tx.update(pushDeliveries).set({
      status: "sending", nextAttemptAt: new Date(Date.now() + 120_000),
    }).where(inArray(pushDeliveries.id, rows.map(r => r.id)));
    return rows;
  });
  await Promise.all(batch.map(async row => {
    const update = (values: Partial<typeof pushDeliveries.$inferInsert>) =>
      db.update(pushDeliveries).set(values).where(eq(pushDeliveries.id, row.id));
    if (row.expiresAt <= new Date()) { await update({ status: "expired", reason: "Notification expired before Apple accepted it" }); return; }
    const [device] = await db.select().from(pushDevices).where(eq(pushDevices.id, row.deviceId)).limit(1);
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, row.userId)).limit(1);
    const [trigger] = row.triggerId === "test" ? [] : await db.select().from(pushTriggers).where(eq(pushTriggers.id, row.triggerId)).limit(1);
    // Recheck ownership and preferences immediately before dispatch: a token can
    // move to a different account, or a user can opt out while a job is waiting.
    if (!device?.enabled || device.userId !== row.userId || !pushPreferenceAllows(row.triggerId, prefs) ||
      row.triggerId !== "test" && !trigger?.enabled) {
      await update({ status: "skipped", reason: "Device, preference or trigger disabled" }); return;
    }
    if ((row.triggerId === "event_reminder" || row.triggerId === "payment_reminder") && row.data.eventId) {
      const [event] = await db.select().from(events).where(eq(events.id, row.data.eventId)).limit(1);
      if (!event) { await update({ status: "skipped", reason: "Event no longer active" }); return; }
      if (row.triggerId === "event_reminder" && new Date(`${event.startDate}T${event.startTime || "00:00"}Z`) <= new Date()) {
        await update({ status: "skipped", reason: "Event has already started" }); return;
      }
      if (row.triggerId === "payment_reminder") {
        const [payment] = await db.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.userId, row.userId))).limit(1);
        if (!paymentWindow(event).canPay || payment && ["hold_created", "captured", "refunded", "cancelled"].includes(payment.status || "")) {
          await update({ status: "skipped", reason: "Payment no longer outstanding or payable" }); return;
        }
      }
      if (trigger?.audience !== "team_members") {
        const [attendance] = await db.select().from(eventAttendance).where(and(
          eq(eventAttendance.eventId, event.id), eq(eventAttendance.userId, row.userId), inArray(eventAttendance.status, ["attending", "promoted"]),
        )).limit(1);
        if (!attendance) { await update({ status: "skipped", reason: "Player is no longer attending" }); return; }
      } else {
        const [member] = await db.select().from(teamMemberships).where(and(eq(teamMemberships.teamId, event.primaryTeamId), eq(teamMemberships.userId, row.userId))).limit(1);
        if (!member) { await update({ status: "skipped", reason: "Player is no longer a team member" }); return; }
      }
    }
    if (!apnsConfiguration(device.environment).configured) {
      await update({ status: "retry", reason: "APNsNotConfigured", nextAttemptAt: new Date(Date.now() + 60_000) }); return;
    }
    const attempts = row.attempts + 1;
    try {
      const response = await sendApplePush({ ...row, token: device.token, environment: device.environment });
      const outcome = classifyApnsResponse(response.status, response.reason);
      if (outcome.invalidDevice) await db.update(pushDevices).set({ enabled: false, updatedAt: new Date() }).where(and(
        eq(pushDevices.id, device.id), eq(pushDevices.token, device.token), eq(pushDevices.updatedAt, device.updatedAt),
      ));
      await update({
        attempts, status: outcome.accepted ? "accepted" : outcome.retryable && attempts < 6 ? "retry" : "failed",
        reason: response.reason, acceptedAt: outcome.accepted ? new Date() : null,
        nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000),
      });
    } catch {
      // Never log HTTP headers, provider JWTs, private keys or device tokens.
      await update({
        attempts, status: attempts < 6 ? "retry" : "failed", reason: "APNsConnectionError",
        nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000),
      });
    }
  }));
}

export async function processScheduledReminders() {
  const active = await db.select().from(pushTriggers).where(and(eq(pushTriggers.enabled, true), inArray(pushTriggers.id, ["event_reminder", "payment_reminder"])));
  if (!active.length) return;
  const now = new Date();
  const earliest = new Date(+now - 86400_000).toISOString().slice(0, 10);
  const latest = new Date(+now + 15 * 86400_000).toISOString().slice(0, 10);
  const upcoming = await db.select().from(events).where(or(
    and(or(gte(events.startDate, earliest), gte(events.endDate, earliest)), lte(events.startDate, latest)),
    // A fixed deadline can be weeks before its event. Select by deadline too,
    // and retain ongoing multi-day events rather than filtering only start dates.
    and(eq(events.paymentRequired, true), gte(events.paymentDeadlineAt, now),
      lte(events.paymentDeadlineAt, new Date(+now + 7 * 86400_000))),
  ));
  for (const event of upcoming) {
    for (const trigger of active) {
      const window = paymentWindow(event, now);
      const target = trigger.id === "event_reminder"
        ? new Date(`${event.startDate}T${event.startTime || "00:00"}Z`) : window.deadline;
      if (trigger.id === "payment_reminder" && (!event.paymentRequired || !window.canPay)) continue;
      const due = new Date(+target - trigger.reminderMinutes * 60_000);
      // Enabling/changing a reminder does not send historical reminders in bulk.
      if (!Number.isFinite(+target) || now < due || now >= target || due < trigger.updatedAt) continue;
      const recipients = trigger.audience === "team_members"
        ? await db.select({ userId: teamMemberships.userId }).from(teamMemberships)
          .where(eq(teamMemberships.teamId, event.primaryTeamId))
        : await db.select({ userId: eventAttendance.userId }).from(eventAttendance)
          .where(and(eq(eventAttendance.eventId, event.id), inArray(eventAttendance.status, ["attending", "promoted"])));
      for (const recipient of recipients) {
        const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, recipient.userId)).limit(1);
        if (!pushPreferenceAllows(trigger.id, prefs)) continue;
        if (trigger.id === "payment_reminder") {
          const [payment] = await db.select().from(eventPayments).where(and(eq(eventPayments.eventId, event.id), eq(eventPayments.userId, recipient.userId))).limit(1);
          if (payment && ["hold_created", "captured", "refunded", "cancelled"].includes(payment.status || "")) continue;
        }
        const created = await db.transaction(async tx => {
          const claim = await tx.insert(pushReminderClaims).values({
            key: `${trigger.id}:${event.id}:${recipient.userId}:${target.toISOString()}`,
          }).onConflictDoNothing().returning();
          if (!claim.length) return;
          const [template] = await tx.select().from(pushTemplates).where(eq(pushTemplates.id, trigger.templateId));
          if (!template) throw new Error("ReminderTemplateMissing");
          const provisional = {
            userId: recipient.userId, relatedId: event.id, type: trigger.id, message: "Open LUDI to review your event.",
            metadata: JSON.stringify({ eventId: event.id }),
          };
          const { context } = await notificationContext(provisional as Notification, tx);
          const [notification] = await tx.insert(notifications).values({
            ...provisional, title: renderTemplate(template.title, context), message: renderTemplate(template.body, context),
          }).returning();
          return notification;
        });
        if (created) notificationWS.sendNotification(created.userId, {
          id: created.id, type: created.type, title: created.title, message: created.message,
          relatedId: created.relatedId || undefined, metadata: { eventId: event.id }, createdAt: created.createdAt || now,
        });
      }
    }
  }
}

export function startNotificationWorkers() {
  let pushRunning = false;
  const pushTick = async () => {
    if (pushRunning) return;
    pushRunning = true;
    try { await processNotificationOutbox(); await processPushDeliveries(); }
    catch (error: any) { logger.error({ errorName: error.name }, "Push processing failed; durable queue will retry"); }
    finally { pushRunning = false; }
  };
  let remindersRunning = false;
  const reminderTick = async () => {
    if (remindersRunning) return;
    remindersRunning = true;
    try { await processScheduledReminders(); }
    catch (error: any) { logger.error({ errorName: error.name }, "Reminder processing failed; will retry"); }
    finally { remindersRunning = false; }
  };
  setTimeout(pushTick, 2000);
  setInterval(pushTick, 5000);
  setTimeout(reminderTick, 10_000);
  setInterval(reminderTick, 60_000);
}