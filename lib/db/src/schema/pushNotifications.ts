import { sql } from "drizzle-orm";
import { pgTable, varchar, text, boolean, integer, timestamp, jsonb, unique, index } from "drizzle-orm/pg-core";
import { users, notifications } from "./schema";

export const platformAdmins = pgTable("platform_admins", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushTemplates = pgTable("push_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 80 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushTriggers = pgTable("push_triggers", {
  id: varchar("id").primaryKey(),
  templateId: varchar("template_id").notNull().references(() => pushTemplates.id),
  enabled: boolean("enabled").notNull().default(true),
  audience: varchar("audience").notNull().default("existing"),
  reminderMinutes: integer("reminder_minutes").notNull().default(1440),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushDevices = pgTable("push_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  installationId: varchar("installation_id").notNull(),
  token: text("token").notNull(),
  environment: varchar("environment", { enum: ["sandbox", "production"] }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.token, t.environment), index("push_devices_user_idx").on(t.userId)]);

export const pushDeliveries = pgTable("push_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => pushDevices.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notificationId: varchar("notification_id").references(() => notifications.id, { onDelete: "set null" }),
  triggerId: varchar("trigger_id").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  status: varchar("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  reason: text("reason"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("push_deliveries_pending_idx").on(t.status, t.nextAttemptAt)]);

// Claims make scheduled reminders idempotent across restarts and API replicas.
export const pushReminderClaims = pgTable("push_reminder_claims", {
  key: text("key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushNotificationOutbox = pgTable("push_notification_outbox", {
  notificationId: varchar("notification_id").primaryKey().references(() => notifications.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushAdminAudit = pgTable("push_admin_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});