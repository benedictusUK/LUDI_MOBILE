import { and, asc, desc, eq, sql } from "drizzle-orm";
import { events, teams, teamMemberships, eventTeams, eventAttendance, userEvents } from "@workspace/db";
import type { db } from "../db";

export function userEventConditions(userId: string, includePast: boolean, teamId?: string, now = new Date()) {
  // EXISTS avoids duplicating events when several of a user's teams participate,
  // or when the user both belongs to a team and follows its event.
  const accessible = sql`(
    EXISTS (SELECT 1 FROM ${teamMemberships}
      WHERE ${teamMemberships.userId} = ${userId} AND ${teamMemberships.teamId} = ${events.primaryTeamId})
    OR EXISTS (SELECT 1 FROM ${teamMemberships}
      WHERE ${teamMemberships.userId} = ${userId} AND ${teamMemberships.teamId} = ANY(${events.secondaryTeamIds}))
    OR EXISTS (SELECT 1 FROM ${eventTeams}
      INNER JOIN ${teamMemberships} ON ${teamMemberships.teamId} = ${eventTeams.teamId}
      WHERE ${eventTeams.eventId} = ${events.id} AND ${teamMemberships.userId} = ${userId})
    OR EXISTS (SELECT 1 FROM ${userEvents}
      WHERE ${userEvents.eventId} = ${events.id} AND ${userEvents.userId} = ${userId})
  )`;
  // Preserve the legacy end-time rules, including ongoing/overnight events.
  const endAt = sql`CASE
    WHEN NULLIF(${events.endTime}, '') IS NOT NULL
      THEN COALESCE(${events.endDate}, ${events.startDate})::date + ${events.endTime}::time
    ELSE ${events.startDate}::date + TIME '23:59:59'
  END`;
  return and(
    accessible,
    includePast
      ? sql`${endAt} <= ${now.toISOString()}::timestamp`
      : sql`${endAt} > ${now.toISOString()}::timestamp`,
    teamId ? sql`(${events.primaryTeamId} = ${teamId}
      OR ${teamId} = ANY(${events.secondaryTeamIds})
      OR EXISTS (SELECT 1 FROM ${eventTeams} WHERE ${eventTeams.eventId} = ${events.id} AND ${eventTeams.teamId} = ${teamId}))` : undefined,
  );
}

export async function queryUserEvents(
  database: typeof db, userId: string, includePast = false,
  page = 1, limit = 1000, teamId?: string, votingStatus = "all",
) {
  const conditions = userEventConditions(userId, includePast, teamId);
  const attendanceJoin = and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.userId, userId));
  const pageSize = Math.min(1000, Math.max(1, Math.trunc(limit) || 1000));
  const pageNumber = Math.max(1, Math.trunc(page) || 1);
  const startAt = sql`${events.startDate}::date + COALESCE(NULLIF(${events.startTime}, ''), '00:00')::time`;
  // Counts are intentionally before the voting filter, as in the existing API.
  const [rows, [counts]] = await Promise.all([
    database.select({ event: events, primaryTeam: teams, userAttendance: eventAttendance })
      .from(events).innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .leftJoin(eventAttendance, attendanceJoin)
      .where(and(conditions, votingStatus !== "all"
        ? sql`COALESCE(${eventAttendance.status}, 'not_voted') = ${votingStatus}` : undefined))
      .orderBy(includePast ? desc(startAt) : asc(startAt), asc(events.id))
      .limit(pageSize).offset((pageNumber - 1) * pageSize),
    database.select({
      totalCount: sql<number>`count(*)`.mapWith(Number),
      attending: sql<number>`count(*) FILTER (WHERE ${eventAttendance.status} = 'attending')`.mapWith(Number),
      not_attending: sql<number>`count(*) FILTER (WHERE ${eventAttendance.status} = 'not_attending')`.mapWith(Number),
      not_voted: sql<number>`count(*) FILTER (WHERE ${eventAttendance.status} IS NULL)`.mapWith(Number),
    }).from(events).innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .leftJoin(eventAttendance, attendanceJoin).where(conditions),
  ]);
  return {
    events: rows.map(row => ({ ...row.event, primaryTeam: row.primaryTeam, userAttendance: row.userAttendance })),
    totalCount: counts.totalCount,
    attendanceCounts: {
      attending: counts.attending, not_attending: counts.not_attending, not_voted: counts.not_voted,
    },
  };
}