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
import { z } from "zod/v4";

import { relations } from "drizzle-orm";
import { paymentTimestampSchema, paymentPolicies } from "./eventPaymentPolicy";
import type { FeeConfiguration } from "./paymentPricing";

// Sports constants including Team Social for non-sporting events
export const SPORTS = [
  "Team Social", // Always available for all teams - non-sporting events
  "Badminton",
  "Basketball",
  "Boxing",
  "Cricket",
  "Cycling",
  "Fitness Training",
  "Football",
  "Golf",
  "Hiking",
  "Hockey",
  "Martial Arts",
  "Other",
  "Paddle",
  "Rugby",
  "Running",
  "Squash",
  "Swimming",
  "Table Tennis",
  "Tennis",
  "Volleyball",
  "Walking",
  "Wild Camping",
  "Yoga",
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
  id: varchar("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  authProvider: varchar("auth_provider", { enum: ["replit", "google", "apple"] }).default("replit"), // tracks OAuth provider
  username: varchar("username").unique(), // will be required for profile completion
  phoneNumber: varchar("phone_number"),
  dateOfBirth: date("date_of_birth"), // will be required for profile completion
  postcode: varchar("postcode"), // will be required for profile completion
  gender: varchar("gender", { enum: ["male", "female"] }), // will be required for profile completion
  sportsInterests: text("sports_interests").array().default(sql`'{}'::text[]`), // sports user is interested in
  travelRadius: integer("travel_radius").default(10), // km radius willing to travel
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeAccountId: varchar("stripe_account_id"), // Stripe Connect account for receiving payouts
  payoutsEnabled: boolean("payouts_enabled").default(false), // tracks if Stripe Connect is fully set up
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
  teamImagePath: varchar("team_image_path"), // path to team's uploaded image
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
}, (table) => [
  index("team_memberships_user_team_idx").on(table.userId, table.teamId),
]);

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

// Team invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invitedById: varchar("invited_by_id").notNull().references(() => users.id),
  status: varchar("status", { enum: ["pending", "accepted", "declined"] }).default("pending"),
  invitedAt: timestamp("invited_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
}, (table) => [
  unique().on(table.teamId, table.userId) // Prevent duplicate invitations
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
  address: text("address"), // Full address for location-based features like flare gun radius
  postcode: varchar("postcode", { length: 20 }), // Postcode for radius calculations
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0.00"),
  maxParticipants: integer("max_participants"), // Maximum number of participants
  reserveSpots: integer("reserve_spots").default(0), // Number of reserve spots available
  requirements: text("requirements"),
  gender: varchar("gender", { enum: ["male", "female", "mixed"] }).notNull().default("mixed"), // event gender restriction
  recurrence: varchar("recurrence", { length: 50 }).default("none"), // none, weekly, monthly, custom
  primaryTeamId: varchar("primary_team_id").notNull().references(() => teams.id),
  secondaryTeamIds: text("secondary_team_ids").array().default(sql`'{}'`),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  venueOrganiserId: varchar("venue_organiser_id").references(() => users.id),
  isPublished: boolean("is_published").default(false),
  enableVoting: boolean("enable_voting").default(false),
  venueBooked: boolean("venue_booked").default(false),
  lateVotePenalty: decimal("late_vote_penalty", { precision: 10, scale: 2 }).default("0.00"),
  overduePaymentReminders: boolean("overdue_payment_reminders").default(false),

  // Flare gun status
  flareStatus: varchar("flare_status", { enum: ["inactive", "active"] }).default("inactive"), // Whether event is actively seeking players
  flareActivatedAt: timestamp("flare_activated_at"), // When flare was last activated
  flareActivatedById: varchar("flare_activated_by_id").references(() => users.id), // Who activated the flare

  // Recurring events
  recurrenceType: varchar("recurrence_type", { enum: ["none", "daily", "weekly", "monthly"] }).default("none"),
  recurrenceEndDate: date("recurrence_end_date"),
  recurrenceAnchorDate: date("recurrence_anchor_date"),
  recurrenceDaysOfWeek: text("recurrence_days_of_week").array().default(sql`'{}'`), // e.g., ['monday', 'wednesday', 'friday']
  recurringSeriesId: varchar("recurring_series_id"), // Groups all events in a recurring series
  isRecurringSuspended: boolean("is_recurring_suspended").default(false), // For pausing recurrence
  parentEventId: varchar("parent_event_id"), // Self-reference handled in relations
  
  // Payment fields for Stripe integration
  paymentRequired: boolean("payment_required").default(false),
  feeConfiguration: jsonb("fee_configuration").$type<FeeConfiguration>(),
  paymentPolicy: varchar("payment_policy", {
    enum: ["none", "fixed_threshold", "fixed_immediate", "flexible_post_event"],
  }).notNull().default("none"),
  currency: varchar("currency", { length: 3 }).notNull().default("gbp"),
  fixedPriceMinor: integer("fixed_price_minor"),
  minimumPaidParticipants: integer("minimum_paid_participants"),
  paymentDeadlineAt: timestamp("payment_deadline_at", { withTimezone: true }),
  authorizationOpensAt: timestamp("authorization_opens_at", { withTimezone: true }),
  completionDueAt: timestamp("completion_due_at", { withTimezone: true }),
  maxPlayerPayment: decimal("max_player_payment", { precision: 10, scale: 2 }), // buffer amount for holds
  finalVenueCost: decimal("final_venue_cost", { precision: 10, scale: 2 }), // actual cost set post-event
  paymentStatus: varchar("payment_status", { enum: ["none", "setup", "holds_created", "captured", "refunded", "partial_captured"] }).default("none"),
  paymentCollectionInitiated: boolean("payment_collection_initiated").default(false),
  paymentCollectionInitiatedAt: timestamp("payment_collection_initiated_at"),
  paymentCollectionInitiatedBy: varchar("payment_collection_initiated_by").references(() => users.id),
  
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
}, (table) => [
  index("event_teams_event_team_idx").on(table.eventId, table.teamId),
]);

// Event attendance tracking
export const eventAttendance = pgTable("event_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, attending, not_attending, voted_late, reserve, promoted
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
  status: varchar("status", { length: 50 }).default("pending"), // pending, paid, overdue, refunded, transferred
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  type: varchar("type", { length: 50 }).notNull(), // event_fee, membership, penalty
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event payments tracking for Stripe holds/reserved payments
export const eventPayments = pgTable("event_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id"),
  setupIntentId: varchar("setup_intent_id"), // for storing payment method
  setupIntentStatus: varchar("setup_intent_status", { enum: ["requires_payment_method", "requires_confirmation", "succeeded", "canceled"] }),
  setupIntentClientSecret: varchar("setup_intent_client_secret"), // client secret for Stripe setup intent
  paymentMethodId: varchar("payment_method_id"), // stored payment method from setup intent
  paymentIntentId: varchar("payment_intent_id"), // for the hold/reserved payment
  stripeChargeId: varchar("stripe_charge_id"),
  stripeBalanceTransactionId: varchar("stripe_balance_transaction_id"),
  paymentIntentStatus: varchar("payment_intent_status", { enum: ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded"] }),
  agreedAmountMinor: integer("agreed_amount_minor"),
  settledBaseAmountMinor: integer("settled_base_amount_minor"),
  authorizedAmountMinor: integer("authorized_amount_minor").default(0),
  capturedAmountMinor: integer("captured_amount_minor").default(0),
  refundedAmountMinor: integer("refunded_amount_minor").default(0),
  platformFeeMinor: integer("platform_fee_minor").default(0),
  organiserAmountMinor: integer("organiser_amount_minor").default(0),
  stripeFeeMinor: integer("stripe_fee_minor"),
  currency: varchar("currency", { length: 3 }).notNull().default("gbp"),
  captureDeadlineAt: timestamp("capture_deadline_at", { withTimezone: true }),
  holdAmount: decimal("hold_amount", { precision: 10, scale: 2 }), // max amount held (with buffer)
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }), // actual amount captured
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }), // amount refunded if any
  status: varchar("status", { enum: ["setup_pending", "setup_complete", "hold_created", "captured", "refunded", "cancelled"] }).default("setup_pending"),
  holdCreatedAt: timestamp("hold_created_at"), // when 48h payment intent was created
  capturedAt: timestamp("captured_at"), // when payment was captured post-event
  refundedAt: timestamp("refunded_at"), // when refund was processed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.eventId, table.userId) // one payment tracking record per user per event
]);

// Durable receipt ledger for Stripe webhooks. Stripe can deliver the same event
// more than once, so its event ID is the idempotency boundary for processing.
// The complete webhook payload is deliberately not persisted here because it
// can contain customer and payment-method data that LUDI does not need.
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  stripeEventId: varchar("stripe_event_id").primaryKey(),
  type: varchar("type", { length: 255 }).notNull(),
  objectId: varchar("object_id"),
  accountId: varchar("account_id"),
  apiVersion: varchar("api_version"),
  livemode: boolean("livemode").notNull(),
  status: varchar("status", {
    enum: ["received", "processing", "processed", "failed"],
  }).notNull().default("received"),
  attemptCount: integer("attempt_count").notNull().default(1),
  lastError: text("last_error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_stripe_webhook_status_updated").on(table.status, table.updatedAt),
  index("IDX_stripe_webhook_type_received").on(table.type, table.receivedAt),
]);

export const paymentOperations = pgTable("payment_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventPaymentId: varchar("event_payment_id").references(() => eventPayments.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").references(() => events.id, { onDelete: "cascade" }),
  operationKey: varchar("operation_key").notNull().unique(),
  kind: varchar("kind", { enum: ["setup", "authorize", "capture", "cancel", "refund", "transfer_reversal"] }).notNull(),
  status: varchar("status", { enum: ["pending", "processing", "succeeded", "failed"] }).notNull().default("pending"),
  stripeIdempotencyKey: varchar("stripe_idempotency_key").notNull().unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const paymentRefunds = pgTable("payment_refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventPaymentId: varchar("event_payment_id").notNull().references(() => eventPayments.id, { onDelete: "restrict" }),
  stripeRefundId: varchar("stripe_refund_id").unique(),
  requestKey: varchar("request_key").notNull().unique(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status").notNull(),
  reason: varchar("reason"),
  reverseTransfer: boolean("reverse_transfer").notNull().default(true),
  refundApplicationFee: boolean("refund_application_fee").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentTransfers = pgTable("payment_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventPaymentId: varchar("event_payment_id").notNull().references(() => eventPayments.id, { onDelete: "restrict" }),
  stripeTransferId: varchar("stripe_transfer_id").notNull().unique(),
  destinationAccountId: varchar("destination_account_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  reversedAmountMinor: integer("reversed_amount_minor").notNull().default(0),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentDisputes = pgTable("payment_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventPaymentId: varchar("event_payment_id").notNull().references(() => eventPayments.id, { onDelete: "restrict" }),
  stripeDisputeId: varchar("stripe_dispute_id").notNull().unique(),
  stripeChargeId: varchar("stripe_charge_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status").notNull(),
  reason: varchar("reason"),
  evidenceDueAt: timestamp("evidence_due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // event, team, payment, system, flare_gun
  relatedId: varchar("related_id"), // ID of related event, team, etc.
  metadata: text("metadata"), // JSON string for additional data like requestUserId
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
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

// User followed events - for events user wants to track outside of team membership
export const userEvents = pgTable("user_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow(),
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
  eventPayments: many(eventPayments),
  notificationPreferences: one(notificationPreferences),
  flareResponses: many(flareResponses),
  userEvents: many(userEvents),
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

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamInvitations.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [teamInvitations.invitedById],
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
  venueOrganiser: one(users, {
    fields: [events.venueOrganiserId],
    references: [users.id],
  }),
  eventTeams: many(eventTeams),
  attendance: many(eventAttendance),
  payments: many(payments),
  eventPayments: many(eventPayments),
  flareResponses: many(flareResponses),
  userEvents: many(userEvents),
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

export const eventPaymentsRelations = relations(eventPayments, ({ one }) => ({
  event: one(events, {
    fields: [eventPayments.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventPayments.userId],
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

export const userEventsRelations = relations(userEvents, ({ one }) => ({
  event: one(events, {
    fields: [userEvents.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [userEvents.userId],
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
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().regex(/^(\+44|0)[0-9]{10}$/, "Please enter a valid UK phone number"),
});

// Auth-specific user schema for OAuth providers (only requires basic fields)
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  authProvider: z.enum(["replit", "google", "apple"]).default("replit"),
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
  gender: z.enum(["male", "female"], { error: "Please select either Male or Female" }),
  sportsInterests: z.array(z.string()).min(1, "Please select at least one sport you're interested in"),
  travelRadius: z.number().min(1, "Travel radius must be at least 1 km").max(100, "Travel radius cannot exceed 100 km"),
});

// Profile update schema (editable fields only)
export const updateProfileSchema = z.object({
  username: profileCompletionSchema.shape.username.optional(),
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
  gender: z.enum(["male", "female"], { error: "Please select either Male or Female" }),
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
  endTime: z.string().nullable().optional().transform((val) => val || null).refine((val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), "End time must be in HH:MM format (24-hour)"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "mixed"]).default("mixed"),
  primaryTeamId: z.string().min(1, "Team selection is required"),
  secondaryTeamIds: z.array(z.string()).optional().default([]),
  cost: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (typeof val === 'number') return val.toString();
    return val || "0.00";
  }),
  endDate: z.string().nullable().optional().transform((val) => val || null),
  requirements: z.string().min(1, "Description is required"),
  maxParticipants: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }).refine((val) => val === null || val > 0, "Maximum participants must be greater than 0"),
  reserveSpots: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (typeof val === 'string') return val === '' ? 0 : parseInt(val);
    return val || 0;
  }).refine((val) => val >= 0, "Reserve spots cannot be negative"),
  // Recurring event fields
  recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceEndDate: z.string().nullable().optional().transform((val) => val || null),
  recurrenceDaysOfWeek: z.array(z.string()).default([]),
  recurringSeriesId: z.string().optional(),
  isRecurringSuspended: z.boolean().default(false),
  // Payment fields
  paymentRequired: z.boolean().default(false),
  paymentPolicy: z.enum(paymentPolicies).optional(),
  currency: z.literal("gbp").optional(),
  fixedPriceMinor: z.number().int().min(50).max(99_999_999).nullable().optional(),
  minimumPaidParticipants: z.number().int().positive().nullable().optional(),
  paymentDeadlineAt: paymentTimestampSchema,
  authorizationOpensAt: paymentTimestampSchema,
  completionDueAt: paymentTimestampSchema,
  maxPlayerPayment: z.union([z.string(), z.number()]).nullable().optional().transform((val) => {
    if (typeof val === 'number') return val.toString();
    return val || null;
  }),
  finalVenueCost: z.union([z.string(), z.number()]).nullable().optional().transform((val) => {
    if (typeof val === 'number') return val.toString();
    return val || null;
  }),
  paymentStatus: z.enum(["none", "setup", "holds_created", "captured", "refunded", "partial_captured"]).default("none"),
  paymentCollectionInitiated: z.boolean().default(false),
  paymentCollectionInitiatedAt: z.date().optional(),
  paymentCollectionInitiatedBy: z.string().optional(),
  venueOrganiserId: z.string().nullable().optional().transform(val => val || null),
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

export const insertEventPaymentSchema = createInsertSchema(eventPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
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
export type EventPayment = typeof eventPayments.$inferSelect;
export type InsertEventPayment = z.infer<typeof insertEventPaymentSchema>;

export const insertBlockedMemberSchema = createInsertSchema(blockedMembers).omit({
  id: true,
  blockedAt: true,
});
export type InsertBlockedMember = z.infer<typeof insertBlockedMemberSchema>;
export type BlockedMember = typeof blockedMembers.$inferSelect;

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  invitedAt: true,
  respondedAt: true,
});
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type FlareResponse = typeof flareResponses.$inferSelect;
export const insertFlareResponseSchema = createInsertSchema(flareResponses).omit({
  id: true,
  respondedAt: true,
});
export type InsertFlareResponse = z.infer<typeof insertFlareResponseSchema>;

// Platform charges configuration table
export const platformCharges = pgTable("platform_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "stripe_fee", "ludi_platform_fee"
  type: varchar("type", { enum: ["percentage", "fixed"] }).notNull(),
  value: decimal("value", { precision: 10, scale: 4 }).notNull(), // percentage (0.029 for 2.9%) or fixed amount
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Event payment audit log for tracking all payment transactions
export const eventPaymentAudits = pgTable("event_payment_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // user who made the payment (null for system actions)
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }), // user who triggered the action (admin)
  actionType: varchar("action_type", { 
    enum: ["payment_authorized", "payment_captured", "payment_refunded", "payment_failed", "manual_payment_recorded", "transfer_initiated", "transfer_completed", "transfer_failed"] 
  }).notNull(),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }), // total amount before fees
  ludiFee: decimal("ludi_fee", { precision: 10, scale: 2 }), // LUDI platform fee
  stripeFee: decimal("stripe_fee", { precision: 10, scale: 2 }), // Stripe processing fee
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }), // amount after fees (what goes to bank)
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }), // running bank balance after this transaction
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeTransferId: varchar("stripe_transfer_id"),
  metadata: text("metadata"), // JSON for additional data
  notes: text("notes"), // admin notes for manual payments
  createdAt: timestamp("created_at").defaultNow(),
});

// Event reimbursements tracking for venue organiser payouts
export const eventReimbursements = pgTable("event_reimbursements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  organiserId: varchar("organiser_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organiserPlayed: boolean("organiser_played").default(false), // whether organiser was an attendee
  venueCost: decimal("venue_cost", { precision: 10, scale: 2 }).notNull(), // total venue cost
  perPlayerShare: decimal("per_player_share", { precision: 10, scale: 2 }).notNull(), // cost per player
  expectedPayout: decimal("expected_payout", { precision: 10, scale: 2 }).notNull(), // venue cost minus organiser share if they played
  netCollected: decimal("net_collected", { precision: 10, scale: 2 }).default("0.00"), // total collected (fees excluded)
  playersRequired: integer("players_required").notNull(), // number of players who need to pay
  playersPaid: integer("players_paid").default(0), // number who have paid
  transferStatus: varchar("transfer_status", { 
    enum: ["pending", "ready", "initiated", "completed", "failed"] 
  }).default("pending"),
  stripeTransferId: varchar("stripe_transfer_id"),
  transferAmount: decimal("transfer_amount", { precision: 10, scale: 2 }), // actual amount transferred
  transferredAt: timestamp("transferred_at"),
  transferError: text("transfer_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.eventId) // one reimbursement record per event
]);

export type PlatformCharge = typeof platformCharges.$inferSelect;
export type InsertPlatformCharge = typeof platformCharges.$inferInsert;

export const insertPlatformChargeSchema = createInsertSchema(platformCharges);
export const platformChargeSchema = insertPlatformChargeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Event Payment Audit types
export type EventPaymentAudit = typeof eventPaymentAudits.$inferSelect;
export type InsertEventPaymentAudit = typeof eventPaymentAudits.$inferInsert;

export const insertEventPaymentAuditSchema = createInsertSchema(eventPaymentAudits).omit({
  id: true,
  createdAt: true,
});

// Event Reimbursement types
export type EventReimbursement = typeof eventReimbursements.$inferSelect;
export type InsertEventReimbursement = typeof eventReimbursements.$inferInsert;

export const insertEventReimbursementSchema = createInsertSchema(eventReimbursements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
