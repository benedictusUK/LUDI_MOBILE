import { pgTable, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { events, users } from "./schema";

export type FinalPlayer = { userId: string; method: "online" | "cash"; cashAmountMinor: number; cashReceivedAt?: string };
export type CloseTransfer = { sourceKey: string; chargeId: string; amountMinor: number; transferId?: string };
export const eventCloseouts = pgTable("event_closeouts", {
  eventId: varchar("event_id").primaryKey().references(() => events.id, { onDelete: "restrict" }),
  venueCostMinor: integer("venue_cost_minor").notNull(),
  players: jsonb("players").$type<FinalPlayer[]>().notNull(),
  status: varchar("status", { enum: ["draft", "reconciling", "ready", "closing", "closed"] }).notNull().default("draft"),
  transferPlan: jsonb("transfer_plan").$type<CloseTransfer[]>().notNull().default([]),
  payoutMinor: integer("payout_minor"),
  destinationAccountId: varchar("destination_account_id"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  lastError: varchar("last_error"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const eventCloseoutLinks = pgTable("event_closeout_links", {
  id: varchar("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  checkoutSessionId: varchar("checkout_session_id").unique(),
  checkoutUrl: varchar("checkout_url"),
  baseAmountMinor: integer("base_amount_minor").notNull(),
  totalAmountMinor: integer("total_amount_minor").notNull(),
  status: varchar("status", { enum: ["creating", "open", "paid", "expired"] }).notNull(),
  paymentIntentId: varchar("payment_intent_id"),
  chargeId: varchar("charge_id"),
  refundedAmountMinor: integer("refunded_amount_minor").notNull().default(0),
  refundId: varchar("refund_id"),
  refundPending: boolean("refund_pending").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const eventCloseoutRefunds = pgTable("event_closeout_refunds", {
  id: varchar("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  sourceKey: varchar("source_key").notNull(),
  paymentIntentId: varchar("payment_intent_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  targetRefundMinor: integer("target_refund_minor").notNull(),
  stripeRefundId: varchar("stripe_refund_id"),
  status: varchar("status").notNull().default("pending"),
  error: varchar("error"),
});
