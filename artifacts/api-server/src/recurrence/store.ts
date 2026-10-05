import { randomUUID } from "node:crypto";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { events, eventTeams, recurringPaymentSettings, type Event, type InsertEvent } from "@workspace/db";
import { db } from "../db";
import { addDays, dayNumber, hasExpired, londonNow, occurrenceDates, occurrenceOnOrAfter, RECURRING_WINDOW, RecurrenceError, revisedSchedule, shiftedEndDate } from "./calendar";

function instance(template: InsertEvent | Event, startDate: string, seriesId: string, replacementFor: string | null = null) {
  const { id: _id, createdAt: _created, updatedAt: _updated, ...settings } = template as Event;
  return {
    ...settings, id: randomUUID(), recurringSeriesId: seriesId, parentEventId: replacementFor,
    startDate, endDate: shiftedEndDate(template, startDate),
    ...recurringPaymentSettings(template, startDate),
    paymentStatus: "none" as const, finalVenueCost: null, paymentCollectionInitiated: false,
    paymentCollectionInitiatedAt: null, paymentCollectionInitiatedBy: null,
    flareStatus: "inactive" as const, flareActivatedAt: null, flareActivatedById: null,
    venueBooked: false,
  };
}

export class RecurringEventStore {
  constructor(private database = db) {}
  async create(template: InsertEvent, now = new Date()): Promise<Event[]> {
    const schedule = { ...template, recurrenceAnchorDate: template.startDate };
    const today = londonNow(now).slice(0, 10);
    const duration = template.endDate ? dayNumber(template.endDate) - dayNumber(template.startDate) : 1;
    let first = occurrenceOnOrAfter(schedule, addDays(today, -Math.max(1, duration)));
    while (first && hasExpired({ ...schedule, startDate: first, endDate: shiftedEndDate(schedule, first) }, now)) {
      first = occurrenceOnOrAfter(schedule, addDays(first, 1));
    }
    const dates = first ? occurrenceDates(schedule, RECURRING_WINDOW, first) : [];
    if (!dates.length) throw new RecurrenceError("The recurrence end date leaves no upcoming occurrences.");
    const seriesId = randomUUID();
    return this.database.transaction(async tx => {
      const created = await tx.insert(events).values(dates.map(date => instance(schedule, date, seriesId))).returning();
      const associations = created.flatMap(event => (template.secondaryTeamIds || []).map(teamId => ({ eventId: event.id, teamId, status: "accepted" as const })));
      if (associations.length) await tx.insert(eventTeams).values(associations).onConflictDoNothing();
      return created;
    });
  }
  async maintain(seriesId: string, now = new Date(), maximum = RECURRING_WINDOW): Promise<{ maintained: boolean; created: number; eventId?: string }> {
    return this.database.transaction(async tx => {
      // Shared by cron and manual callers, across server instances, until commit.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${seriesId}, 0))`);
      const rows = await tx.select().from(events).where(eq(events.recurringSeriesId, seriesId)).orderBy(asc(events.startDate), asc(events.startTime), asc(events.createdAt), asc(events.id));
      if (!rows.length) return { maintained: false, created: 0 };
      const latest = rows[rows.length - 1];
      if (latest.isRecurringSuspended || !latest.recurrenceType || latest.recurrenceType === "none") return { maintained: false, created: 0 };
      const future = rows.filter(row => !hasExpired(row, now));
      const used = new Set(rows.map(row => row.parentEventId).filter(Boolean));
      const expired = rows.filter(row => hasExpired(row, now) && !used.has(row.id));
      // Deleting a future occurrence is not an expiry and earns no replacement.
      const count = Math.min(maximum, RECURRING_WINDOW - future.length, expired.length);
      if (count <= 0) return { maintained: false, created: 0 };
      const template = { ...latest, recurrenceAnchorDate: latest.recurrenceAnchorDate || rows[0].startDate };
      let from = addDays(latest.startDate, 1);
      const today = londonNow(now).slice(0, 10);
      const duration = template.endDate ? dayNumber(template.endDate) - dayNumber(template.startDate) : 1;
      const earliestActive = addDays(today, -Math.max(1, duration));
      if (from < earliestActive) from = earliestActive;
      let first = occurrenceOnOrAfter(template, from);
      while (first && hasExpired({ ...template, startDate: first, endDate: shiftedEndDate(template, first) }, now)) {
        first = occurrenceOnOrAfter(template, addDays(first, 1));
      }
      const dates = first ? occurrenceDates(template, count, first) : [];
      if (!dates.length) return { maintained: false, created: 0 };
      const created = await tx.insert(events).values(dates.map((date, index) => instance(template, date, seriesId, expired[index].id))).returning();
      const sourceTeams = await tx.select().from(eventTeams).where(eq(eventTeams.eventId, latest.id));
      const teamIds = [...new Set([latest.primaryTeamId, ...(latest.secondaryTeamIds || []), ...sourceTeams.map(row => row.teamId)])];
      await tx.insert(eventTeams).values(created.flatMap(event => teamIds.map(teamId => ({ eventId: event.id, teamId, status: "invited" as const })))).onConflictDoNothing();
      return { maintained: true, created: created.length, eventId: created[0].id };
    });
  }
  async maintainAll(now = new Date()): Promise<{ maintained: number; created: number; maintenanceTriggered: string[] }> {
    const series = await this.database.selectDistinct({ recurringSeriesId: events.recurringSeriesId }).from(events).where(isNotNull(events.recurringSeriesId));
    let maintained = 0;
    let created = 0;
    const maintenanceTriggered: string[] = [];
    for (const row of series) {
      if (!row.recurringSeriesId) continue;
      const result = await this.maintain(row.recurringSeriesId, now);
      if (result.created) { maintained++; created += result.created; maintenanceTriggered.push(row.recurringSeriesId); }
    }
    return { maintained, created, maintenanceTriggered };
  }
  async update(event: Event, updates: Partial<InsertEvent>, scope: "single" | "future"): Promise<Event[]> {
    return this.database.transaction(async tx => {
      if (event.recurringSeriesId) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.recurringSeriesId}, 0))`);
      if (scope === "single" || !event.recurringSeriesId) {
        return tx.update(events).set(updates).where(eq(events.id, event.id)).returning();
      }
      const allRows = await tx.select().from(events).where(eq(events.recurringSeriesId, event.recurringSeriesId)).orderBy(asc(events.startDate), asc(events.startTime), asc(events.createdAt), asc(events.id));
      const selected = allRows.find(row => row.id === event.id);
      if (!selected) throw new RecurrenceError("The selected event no longer exists.");
      const rows = allRows.filter(row => row.startDate >= selected.startDate);
      const source = { ...selected, recurrenceAnchorDate: selected.recurrenceAnchorDate || allRows[0].startDate };
      const schedule = revisedSchedule(source, updates);
      const patternChanged = schedule.startDate !== source.startDate || schedule.recurrenceType !== source.recurrenceType ||
        [...(schedule.recurrenceDaysOfWeek || [])].sort().join() !== [...(source.recurrenceDaysOfWeek || [])].sort().join();
      const dates = !patternChanged ? rows.map(row => row.startDate) : schedule.recurrenceType === "none"
        ? rows.map(row => addDays(row.startDate, dayNumber(schedule.startDate) - dayNumber(source.startDate)))
        : occurrenceDates(schedule, rows.length);
      if (dates.length !== rows.length || (schedule.recurrenceType !== "none" && schedule.recurrenceEndDate && dates.some(date => date > schedule.recurrenceEndDate!))) {
        throw new RecurrenceError("The end date would exclude existing occurrences. Cancel those occurrences separately first.");
      }
      const result: Event[] = [];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const startDate = dates[index];
        const currentDeadlines = recurringPaymentSettings(row, startDate);
        const selectedDeadlines = recurringPaymentSettings(schedule, startDate);
        const deadlineUpdates = Object.fromEntries(["paymentDeadlineAt", "authorizationOpensAt", "completionDueAt"].map(key =>
          [key, Object.hasOwn(updates, key) ? selectedDeadlines[key as keyof typeof selectedDeadlines] : currentDeadlines[key as keyof typeof currentDeadlines]]));
        const endTemplate = Object.hasOwn(updates, "endDate") ? schedule : row;
        const changed = await tx.update(events).set({
          ...updates, ...deadlineUpdates, startDate, endDate: shiftedEndDate(endTemplate, startDate),
          recurrenceAnchorDate: schedule.recurrenceAnchorDate,
          recurrenceDaysOfWeek: patternChanged ? schedule.recurrenceDaysOfWeek : row.recurrenceDaysOfWeek,
          // Never accept caller-controlled identity or replacement metadata.
          recurringSeriesId: row.recurringSeriesId, parentEventId: row.parentEventId,
        }).where(eq(events.id, row.id)).returning();
        result.push(...changed);
      }
      return result;
    });
  }
}
export const recurringEventStore = new RecurringEventStore();
