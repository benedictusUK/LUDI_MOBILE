import { asc, inArray } from "drizzle-orm";
import { teams } from "@workspace/db";
import { db } from "../db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class ArchivedTeamError extends Error {
  status = 409;
  constructor() { super("Restore archived teams before creating new events or adding them to an event."); }
}

// Share the team row lock with archival. Existing events/payments are untouched.
export async function lockActiveTeams(tx: Tx, ids: string[]) {
  const rows = await tx.select().from(teams).where(inArray(teams.id, [...new Set(ids)]))
    .orderBy(asc(teams.id)).for("share");
  if (rows.some(team => team.archivedAt)) throw new ArchivedTeamError();
}
