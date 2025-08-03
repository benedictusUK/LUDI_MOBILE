import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  date,
  decimal,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { relations } from "drizzle-orm";

// Sports constants including Team Social for non-sporting events
export const SPORTS = [
  "Team Social", // Always available for all teams - non-sporting events
  "Football",
  "Basketball", 
  "Tennis",
  "Cricket",
  "Rugby",
  "Hockey",
  "Badminton",
  "Table Tennis",
  "Swimming",
  "Running",
  "Cycling",
  "Volleyball",
  "Squash",
  "Golf",
  "Boxing",
  "Martial Arts",
  "Yoga",
  "Fitness Training",
  "Other"
] as const;

// Available sports (alias for SPORTS to support both import names)
export const AVAILABLE_SPORTS = SPORTS;

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  username: varchar("username").unique().notNull(), // unique username, required
  phoneNumber: varchar("phone_number").notNull(),
  dateOfBirth: date("date_of_birth").notNull(), // required for age verification
  postcode: varchar("postcode").notNull(), // required
  gender: varchar("gender", { enum: ["male", "female"] }).notNull(), // limited to male/female
  sportsInterests: text("sports_interests").array().default(sql`'{}'::text[]`), // sports user is interested in
  travelRadius: integer("travel_radius").default(10), // km radius willing to travel
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  profileCompletedAt: timestamp("profile_completed_at"), // tracks when mandatory fields completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  sports: text("sports").array().notNull().default(sql`'{}'`),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  maxPlayers: integer("max_players"),
  gender: varchar("gender", { enum: ["male", "female", "mixed"] }).notNull().default("mixed"), // team gender preference
  isPrivate: boolean("is_private").default(false),
  requiresApproval: boolean("requires_approval").default(true),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  inviteCode: varchar("invite_code").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team memberships
export const teamMemberships = pgTable("team_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"), // member, captain, coach, admin
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Blocked members table
export const blockedMembers = pgTable("blocked_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedById: varchar("blocked_by_id").notNull().references(() => users.id),
  reason: text("reason"),
  blockedAt: timestamp("blocked_at").defaultNow(),
}, (table) => [
  unique().on(table.teamId, table.userId)
]);

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  sport: varchar("sport", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endDate: date("end_date"),
  endTime: varchar("end_time", { length: 10 }),
  location: text("location"),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0.00"),
  participants: integer("participants"), // Maximum number of participants
  requirements: text("requirements"),
  gender: varchar("gender", { enum: ["male", "female", "mixed"] }).notNull().default("mixed"), // event gender restriction
  recurrence: varchar("recurrence", { length: 50 }).default("none"), // none, weekly, monthly, custom
  primaryTeamId: varchar("primary_team_id").notNull().references(() => teams.id),
  secondaryTeamIds: text("secondary_team_ids").array().default(sql`'{}'`),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  isPublished: boolean("is_published").default(false),
  enableVoting: boolean("enable_voting").default(false),
  venueBooked: boolean("venue_booked").default(false),
  lateVotePenalty: decimal("late_vote_penalty", { precision: 10, scale: 2 }).default("0.00"),
  overduePaymentReminders: boolean("overdue_payment_reminders").default(false),

  // Recurring events
  recurrenceType: varchar("recurrence_type", { enum: ["none", "weekly", "monthly"] }).default("none"),
  recurrenceEndDate: date("recurrence_end_date"),
  parentEventId: varchar("parent_event_id"), // Self-reference handled in relations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event team participation
export const eventTeams = pgTable("event_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("invited"), // invited, accepted, declined
  createdAt: timestamp("created_at").defaultNow(),
});

// Event attendance tracking
export const eventAttendance = pgTable("event_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, attending, not_attending, voted_late
  votedAt: timestamp("voted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.eventId, table.userId)
]);

// Activity audit log for tracking voting and other actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(), // voted_attending, voted_not_attending, unvoted, changed_vote
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
});

// Payment tracking
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").references(() => events.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, paid, overdue, refunded
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  type: varchar("type", { length: 50 }).notNull(), // event_fee, membership, penalty
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // event, team, payment, system, flare_gun
  relatedId: varchar("related_id"), // ID of related event, team, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  newEvents: boolean("new_events").default(true),
  paymentReminders: boolean("payment_reminders").default(true),
  eventChanges: boolean("event_changes").default(true),
  votingOpportunities: boolean("voting_opportunities").default(false),
  flareGunReminders: boolean("flare_gun_reminders").default(false),
  teamInvites: boolean("team_invites").default(true),
  pushNotificationsIOS: boolean("push_notifications_ios").default(false),
  pushNotificationsAndroid: boolean("push_notifications_android").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId)
]);

// Flared event responses - tracks who responds to flared events
export const flareResponses = pgTable("flare_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { enum: ["interested", "not_interested", "maybe"] }).notNull(),
  respondedAt: timestamp("responded_at").defaultNow(),
}, (table) => [
  unique().on(table.eventId, table.userId)
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  ownedTeams: many(teams),
  teamMemberships: many(teamMemberships),
  createdEvents: many(events),
  notifications: many(notifications),
  eventAttendance: many(eventAttendance),
  payments: many(payments),
  notificationPreferences: one(notificationPreferences),
  flareResponses: many(flareResponses),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerId],
    references: [users.id],
  }),
  memberships: many(teamMemberships),
  events: many(events),
  eventParticipations: many(eventTeams),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, {
    fields: [teamMemberships.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMemberships.userId],
    references: [users.id],
  }),
}));

export const blockedMembersRelations = relations(blockedMembers, ({ one }) => ({
  team: one(teams, {
    fields: [blockedMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [blockedMembers.userId],
    references: [users.id],
  }),
  blockedBy: one(users, {
    fields: [blockedMembers.blockedById],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  primaryTeam: one(teams, {
    fields: [events.primaryTeamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [events.createdById],
    references: [users.id],
  }),
  eventTeams: many(eventTeams),
  attendance: many(eventAttendance),
  payments: many(payments),
  flareResponses: many(flareResponses),
}));

export const eventTeamsRelations = relations(eventTeams, ({ one }) => ({
  event: one(events, {
    fields: [eventTeams.eventId],
    references: [events.id],
  }),
  team: one(teams, {
    fields: [eventTeams.teamId],
    references: [teams.id],
  }),
}));

export const eventAttendanceRelations = relations(eventAttendance, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendance.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendance.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [payments.eventId],
    references: [events.id],
  }),
  team: one(teams, {
    fields: [payments.teamId],
    references: [teams.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  event: one(events, {
    fields: [activityLogs.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const flareResponsesRelations = relations(flareResponses, ({ one }) => ({
  event: one(events, {
    fields: [flareResponses.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [flareResponses.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileCompletedAt: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  dateOfBirth: z.string().min(1, "Date of birth is required").refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    const actualAge = monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0) ? age : age - 1;
    return actualAge >= 18;
  }, "You must be at least 18 years old to sign up"),
  postcode: z.string().min(1, "Postcode is required").max(10, "Postcode must be less than 10 characters"),
  email: z.string().email("Please enter a valid email address").optional(),
  phoneNumber: z.string().regex(/^(\+44|0)[0-9]{10}$/, "Please enter a valid UK phone number").optional(),
});

// Profile completion schema (for mandatory fields after signup)
export const profileCompletionSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().regex(/^(\+44|0)[0-9]{10}$/, "Please enter a valid UK phone number"),
  dateOfBirth: z.string().min(1, "Date of birth is required").refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    const actualAge = monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0) ? age : age - 1;
    return actualAge >= 18;
  }, "You must be at least 18 years old to sign up"),
  postcode: z.string().min(1, "Postcode is required").max(10, "Postcode must be less than 10 characters"),
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Please select either Male or Female" }) }),
  sportsInterests: z.array(z.string()).min(1, "Please select at least one sport you're interested in"),
  travelRadius: z.number().min(1, "Travel radius must be at least 1 km").max(100, "Travel radius cannot exceed 100 km"),
});

// Profile update schema (editable fields only)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().regex(/^(\+44|0)[0-9]{10}$/, "Please enter a valid UK phone number"),
  dateOfBirth: z.string().min(1, "Date of birth is required").refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    const actualAge = monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0) ? age : age - 1;
    return actualAge >= 18;
  }, "You must be at least 18 years old"),
  postcode: z.string().min(1, "Postcode is required").max(10, "Postcode must be less than 10 characters"),
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Please select either Male or Female" }) }),
  sportsInterests: z.array(z.string()).min(1, "Please select at least one sport you're interested in"),
  travelRadius: z.number().min(1, "Travel radius must be at least 1 km").max(100, "Travel radius cannot exceed 100 km"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  inviteCode: true,
  maxPlayers: true,
}).extend({
  name: z.string().min(1, "Team name is required").max(255, "Team name must be less than 255 characters"),
  sports: z.array(z.string()).min(1, "At least one sport must be selected"),
  description: z.string().optional(),
  gender: z.enum(["male", "female", "mixed"]).default("mixed"),
  maxPlayers: z.union([z.number().min(1, "Maximum players must be at least 1"), z.null()]).optional(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Event name is required").max(255, "Event name must be less than 255 characters"),
  sport: z.string().min(1, "Sport selection is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required").regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Start time must be in HH:MM format (24-hour)"),
  endTime: z.string().optional().transform((val) => val || null).refine((val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "End time must be in HH:MM format (24-hour)"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "mixed"]).default("mixed"),
  primaryTeamId: z.string().min(1, "Team selection is required"),
  secondaryTeamIds: z.array(z.string()).optional().default([]),
  cost: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (typeof val === 'number') return val.toString();
    return val || "0.00";
  }),
  endDate: z.string().optional().transform((val) => val || null),
  requirements: z.string().min(1, "Description is required"),
  maxParticipants: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }).refine((val) => val === null || val > 0, "Maximum participants must be greater than 0"),
});

export const insertEventAttendanceSchema = createInsertSchema(eventAttendance).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type ProfileCompletion = z.infer<typeof profileCompletionSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type EventTeam = typeof eventTeams.$inferSelect;
export type EventAttendance = typeof eventAttendance.$inferSelect;
export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

export const insertBlockedMemberSchema = createInsertSchema(blockedMembers).omit({
  id: true,
  blockedAt: true,
});
export type InsertBlockedMember = z.infer<typeof insertBlockedMemberSchema>;
export type BlockedMember = typeof blockedMembers.$inferSelect;
export type FlareResponse = typeof flareResponses.$inferSelect;
export const insertFlareResponseSchema = createInsertSchema(flareResponses).omit({
  id: true,
  respondedAt: true,
});
export type InsertFlareResponse = z.infer<typeof insertFlareResponseSchema>;
