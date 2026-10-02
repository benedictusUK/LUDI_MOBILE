import assert from "node:assert/strict";
import { test, after } from "node:test";
import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";

// Bundle the TypeScript source without installing a second runtime. All database
// work below is SELECT-only; these tests never create or mutate user records.
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  stdin: {
    contents: `export { db, pool, events, teams, users, teamMemberships, eventTeams, userEvents, eventAttendance } from '@workspace/db';
      export { queryUserEvents, userEventConditions } from './src/queries/userEvents';
      export { db as apiDb, pool as apiPool } from './src/db';
      export { eq, and } from 'drizzle-orm';`,
    resolveDir: cwd,
  },
  platform: "node", format: "cjs", bundle: true, write: false, logLevel: "silent",
});
const compiled = new Module(`${cwd}/tests/event-list-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
const { db, pool, events, users, teamMemberships, eventTeams, userEvents, eventAttendance, queryUserEvents, eq } = compiled.exports;
after(() => Promise.all([pool.end(), compiled.exports.apiPool.end()]));

test("event query preserves access, expiry, ordering, pagination and voting counts", async () => {
  const [allEvents, memberships, links, follows, attendance, accounts] = await Promise.all([
    db.select().from(events), db.select().from(teamMemberships), db.select().from(eventTeams),
    db.select().from(userEvents), db.select().from(eventAttendance), db.select({ id: users.id }).from(users),
  ]);
  // Compare against the previous JavaScript rules independently of the new SQL.
  for (const { id: userId } of accounts) {
    const teamIds = new Set(memberships.filter(m => m.userId === userId).map(m => m.teamId));
    const secondaryIds = new Set(links.filter(l => teamIds.has(l.teamId)).map(l => l.eventId));
    const followedIds = new Set(follows.filter(f => f.userId === userId).map(f => f.eventId));
    const available = allEvents.filter(e => teamIds.has(e.primaryTeamId) || secondaryIds.has(e.id) || followedIds.has(e.id));
    const voteFor = e => attendance.find(a => a.eventId === e.id && a.userId === userId)?.status ?? null;
    for (const past of [false, true]) {
      const now = new Date();
      const eligible = available.filter(e => {
        let end;
        if (e.endTime) end = new Date(`${e.endDate || e.startDate}T${e.endTime}`);
        else { end = new Date(e.startDate); end.setHours(23, 59, 59); }
        return (end <= now) === past;
      }).sort((a, b) => {
        const difference = +new Date(`${a.startDate}T${a.startTime || '00:00'}`) - +new Date(`${b.startDate}T${b.startTime || '00:00'}`);
        return (past ? -difference : difference) || a.id.localeCompare(b.id);
      });
      const expectedCounts = {
        attending: eligible.filter(e => voteFor(e) === 'attending').length,
        not_attending: eligible.filter(e => voteFor(e) === 'not_attending').length,
        not_voted: eligible.filter(e => voteFor(e) === null).length,
      };
      for (const status of ['all', 'attending', 'not_attending', 'not_voted']) {
        const filtered = eligible.filter(e => status === 'all' || (voteFor(e) ?? 'not_voted') === status);
        const actual = await queryUserEvents(db, userId, past, 1, 3, undefined, status);
        assert.equal(actual.totalCount, eligible.length);
        assert.deepEqual(actual.attendanceCounts, expectedCounts);
        assert.deepEqual(actual.events.map(e => e.id), filtered.slice(0, 3).map(e => e.id));
        assert.ok(actual.events.every(e => e.primaryTeam && Object.hasOwn(e, 'userAttendance')));
      }
      const secondPage = await queryUserEvents(db, userId, past, 2, 3);
      assert.deepEqual(secondPage.events.map(e => e.id), eligible.slice(3, 6).map(e => e.id));
      const emptyPage = await queryUserEvents(db, userId, past, 1_000_000, 3);
      assert.equal(emptyPage.events.length, 0);
      assert.equal(emptyPage.totalCount, eligible.length);
      const selectedTeam = available[0]?.primaryTeamId;
      if (selectedTeam) {
        const teamResult = await queryUserEvents(db, userId, past, 1, 1000, selectedTeam);
        assert.deepEqual(teamResult.events.map(e => e.id), eligible.filter(e => e.primaryTeamId === selectedTeam).map(e => e.id));
      }
    }
  }
  assert.ok(accounts.length, "development database needs at least one account to exercise the query");
});

test("event list timing for a warm development connection", async () => {
  const [membership] = await db.select().from(teamMemberships).limit(1);
  assert.ok(membership, "development database needs a team membership");
  const { apiDb } = compiled.exports;
  await queryUserEvents(apiDb, membership.userId, false, 1, 3);
  const timings = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = performance.now();
    await queryUserEvents(apiDb, membership.userId, false, 1, 3);
    timings.push(Math.round(performance.now() - start));
  }
  console.log(`Warm development event-query timings using the API's database client (ms): ${timings.join(', ')}`);
});