import { sql } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import { users } from "./schema";
import type { FeeConfiguration } from "./paymentPricing";

export const platformFeeSettings = pgTable("platform_fee_settings", {
  id: varchar("id").primaryKey(),
  platformBasisPoints: integer("platform_basis_points").notNull(),
  stripeBasisPoints: integer("stripe_basis_points").notNull(),
  stripeFixedMinor: integer("stripe_fixed_minor").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("fee_settings_singleton", sql`${table.id} = 'default'`),
  check("fee_settings_rates", sql`${table.platformBasisPoints} BETWEEN 0 AND 10000 AND ${table.stripeBasisPoints} BETWEEN 0 AND 10000 AND ${table.stripeFixedMinor} BETWEEN 0 AND 1000000 AND ${table.revision} > 0`),
]);
export const platformFeeAudit = pgTable("platform_fee_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  before: jsonb("before").$type<FeeConfiguration>().notNull(),
  after: jsonb("after").$type<FeeConfiguration>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});