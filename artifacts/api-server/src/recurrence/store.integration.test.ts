import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { events, teams, users, insertEventSchema } from "@workspace/db";
import { db, pool } from "../db";
import { RecurringEventStore } from "./store";

test("real PostgreSQL creation, expiry and future edits work; all fixture data is rolled back", async () => {
  const rollback = new Error("Intentional fixture rollback");
  try {
    await db.transaction(async tx => {
      const userId = randomUUID();
      const teamId = randomUUID();
      await tx.insert(users).values({ id: userId, email: `${userId}@recurrence-test.invalid` });
      await tx.insert(teams).values({ id: teamId, name: "Temporary recurrence verification", sports: ["Football"], ownerId: userId });
      // Keep every operation inside the outer rollback-only test transaction.
      const database = { transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as typeof db;
      const store = new RecurringEventStore(database);
      const template = insertEventSchema.parse({
        name: "Temporary recurrence verification", sport: "Football", location: "Test pitch",
        requirements: "Temporary test only", startDate: "2090-01-01", startTime: "19:00",
        endTime: "20:00", endDate: null, primaryTeamId: teamId, secondaryTeamIds: [],
        createdById: userId, recurrenceType: "daily", recurrenceDaysOfWeek: [],
        recurrenceEndDate: null, isRecurringSuspended: false, isPublished: false,
        gender: "mixed", paymentRequired: false, cost: "0.00",
      });
      const created = await store.create(template, new Date("2090-01-01T10:00:00Z"));
      assert.deepEqual(created.map(row => row.startDate), ["2090-01-01", "2090-01-02", "2090-01-03", "2090-01-04", "2090-01-05"]);
      assert.ok(created.every(row => row.recurrenceAnchorDate === "2090-01-01"));
      const seriesId = created[0].recurringSeriesId!;
      assert.equal((await store.maintain(seriesId, new Date("2090-01-01T19:59:59Z"))).created, 0);
      assert.equal((await store.maintain(seriesId, new Date("2090-01-01T20:00:00Z"))).created, 1);
      assert.equal((await store.maintain(seriesId, new Date("2090-01-01T20:00:00Z"))).created, 0);
      const all = await tx.select().from(events).where(eq(events.recurringSeriesId, seriesId));
      assert.equal(all.length, 6);
      const replacement = all.find(row => row.parentEventId === created[0].id);
      assert.equal(replacement?.startDate, "2090-01-06");
      const updated = await store.update(created[1], { name: "Updated future occurrences", startDate: "2090-01-03" }, "future");
      assert.deepEqual(updated.map(row => row.startDate), ["2090-01-03", "2090-01-04", "2090-01-05", "2090-01-06", "2090-01-07"]);
      assert.equal(new Set(updated.map(row => row.id)).size, 5);
      assert.ok(updated.every(row => row.recurringSeriesId === seriesId));
      const [past] = await tx.select().from(events).where(eq(events.id, created[0].id));
      assert.equal(past.startDate, "2090-01-01");
      assert.equal(past.name, template.name);
      throw rollback;
    });
    assert.fail("Test transaction must not commit.");
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await pool.end();
  }
});
