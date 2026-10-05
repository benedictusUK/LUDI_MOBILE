import { insertEventSchema, type InsertEvent } from "@workspace/db";
import { RecurrenceError } from "./calendar";

export function parseEventUpdate(existing: Record<string, any>, body: unknown): Partial<InsertEvent> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RecurrenceError("Supply event changes.");
  const input = body as Record<string, unknown>;
  const validated = insertEventSchema.partial().parse({
    ...input,
    venueOrganiserId: input.venueOrganiserId || existing.venueOrganiserId || existing.createdById,
  });
  const changedKeys = new Set([...Object.keys(input), "venueOrganiserId"]);
  return Object.fromEntries(Object.entries(validated).filter(([key]) =>
    changedKeys.has(key) && !["createdById", "recurringSeriesId", "parentEventId", "recurrenceAnchorDate"].includes(key)
  )) as Partial<InsertEvent>;
}
