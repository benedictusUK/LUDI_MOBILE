import assert from "node:assert/strict";
import { test } from "node:test";
import { events, eventTeams, type Event, type InsertEvent } from "@workspace/db";
import { RecurringEventStore } from "./store";
import { hasExpired, occurrenceDates, RecurrenceError } from "./calendar";
import { parseEventUpdate } from "./updates";

const template = {
  name: "Recurrence test", sport: "Football", requirements: "Bring boots", location: "Test pitch",
  startDate: "2027-01-04", startTime: "19:00", endTime: "20:00", endDate: null,
  primaryTeamId: "primary", secondaryTeamIds: ["secondary"], createdById: "owner",
  recurrenceType: "weekly", recurrenceDaysOfWeek: ["monday", "wednesday"],
  recurrenceEndDate: null, isRecurringSuspended: false, isPublished: true,
  gender: "mixed", paymentRequired: false, cost: "0.00", paymentCollectionInitiatedAt: null,
} as unknown as InsertEvent;
function seeded(): Event[] {
  return occurrenceDates(template, 5).map((startDate, index) => ({
    ...template, id: `e${index}`, startDate, recurringSeriesId: "series", parentEventId: null,
    recurrenceAnchorDate: template.startDate, createdAt: new Date(index),
  })) as Event[];
}

// Exercise repository control flow without creating real accounts or events.
function fixture(initial: Event[] = []) {
  const state = { rows: structuredClone(initial), teams: [] as any[], locks: 0 };
  let queue = Promise.resolve();
  function expression(node: any): { columns: string[]; values: any[] } {
    if (!node) return { columns: [], values: [] };
    if (node.constructor?.name === "Param") return { columns: [], values: [node.value] };
    if (node.name && node.table) return { columns: [node.name], values: [] };
    return (node.queryChunks || []).map(expression).reduce((a: any, b: any) =>
      ({ columns: [...a.columns, ...b.columns], values: [...a.values, ...b.values] }), { columns: [], values: [] });
  }
  function selected(table: unknown, condition: any) {
    let rows = table === events ? state.rows : state.teams;
    const { columns, values } = expression(condition);
    if (columns.includes("recurring_series_id") && values.length) rows = rows.filter(row => row.recurringSeriesId === values[0]);
    if (columns.includes("start_date") && values.length > 1) rows = rows.filter(row => row.startDate >= values[1]);
    if (columns.includes("id")) rows = rows.filter(row => row.id === values[0]);
    if (columns.includes("event_id")) rows = rows.filter(row => row.eventId === values[0]);
    return rows.map(row => ({ ...row })).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "") || +a.createdAt - +b.createdAt);
  }
  function select(distinct = false) {
    let table: unknown; let condition: unknown;
    const run = () => distinct ? [...new Set(state.rows.map(row => row.recurringSeriesId))].map(recurringSeriesId => ({ recurringSeriesId })) : selected(table, condition);
    const query: any = {
      from(value: unknown) { table = value; return query; },
      where(value: unknown) { condition = value; return query; },
      orderBy() { return query; },
      then(resolve: any, reject: any) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return query;
  }
  const tx: any = {
    execute: async () => { state.locks++; },
    select: () => select(), selectDistinct: () => select(true),
    insert(table: unknown) {
      return { values(input: any) {
        const values = Array.isArray(input) ? input : [input];
        const write = () => {
          const rows = values.map(value => ({ ...value, createdAt: new Date() }));
          (table === events ? state.rows : state.teams).push(...rows);
          return rows.map(row => ({ ...row }));
        };
        return { returning: async () => write(), onConflictDoNothing: async () => write() };
      } };
    },
    update(table: unknown) {
      return { set(input: any) { return { where(condition: unknown) { return { returning: async () => {
        const ids = selected(table, condition).map(row => row.id);
        const changed = state.rows.filter(row => ids.includes(row.id));
        changed.forEach(row => Object.assign(row, input));
        return changed.map(row => ({ ...row }));
      } }; } }; } };
    },
  };
  const database: any = {
    ...tx,
    transaction(callback: any) {
      const pending = queue.then(async () => {
        const before = structuredClone(state);
        try { return await callback(tx); } catch (error) { Object.assign(state, before); throw error; }
      });
      queue = pending.then(() => undefined, () => undefined);
      return pending;
    },
  };
  return { state, store: new RecurringEventStore(database) };
}
test("initial creation persists exactly five distinct occurrences in one series", async () => {
  const { state, store } = fixture();
  const rows = await store.create(template, new Date("2027-01-04T10:00:00Z"));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(row => row.startDate), occurrenceDates(template, 5));
  assert.equal(new Set(rows.map(row => row.recurringSeriesId)).size, 1);
  assert.equal(state.teams.length, 5);
});
test("initial creation respects end date and rejects a fully ended series", async () => {
  const { store } = fixture();
  assert.equal((await store.create({ ...template, recurrenceEndDate: "2027-01-11" }, new Date("2027-01-04T10:00Z"))).length, 3);
  await assert.rejects(store.create({ ...template, recurrenceEndDate: "2027-01-03" }, new Date("2027-01-04T10:00Z")), RecurrenceError);
});
test("no expiry means no replacement, even when only four occurrences remain", async () => {
  const { state, store } = fixture(seeded().slice(0, 4));
  assert.equal((await store.maintain("series", new Date("2027-01-04T19:30Z"))).created, 0);
  assert.equal(state.rows.length, 4);
});
test("one expiry creates one correctly spaced replacement and polling cannot repeat it", async () => {
  const { state, store } = fixture(seeded());
  const now = new Date("2027-01-04T20:00:00Z");
  assert.equal((await store.maintain("series", now)).created, 1);
  assert.equal(state.rows[5].startDate, "2027-01-20");
  assert.equal(state.rows[5].parentEventId, "e0");
  assert.equal(state.rows[5].recurringSeriesId, "series");
  assert.equal((await store.maintain("series", now)).created, 0);
  assert.equal(state.rows.filter(row => !hasExpired(row, now)).length, 5);
});
test("concurrent maintenance requests create only one replacement", async () => {
  const { state, store } = fixture(seeded());
  const results = await Promise.all(Array.from({ length: 12 }, () => store.maintain("series", new Date("2027-01-04T21:00Z"))));
  assert.equal(results.reduce((sum, result) => sum + result.created, 0), 1);
  assert.equal(state.rows.length, 6);
  assert.equal(state.locks, 12);
});
test("deleting a future occurrence does not reuse an already replaced expiry", async () => {
  const { state, store } = fixture(seeded());
  const now = new Date("2027-01-04T21:00Z");
  await store.maintain("series", now);
  state.rows = state.rows.filter(row => row.id !== "e2");
  assert.equal((await store.maintain("series", now)).created, 0);
});
test("missed expiries are replaced one-for-one, never beyond five active events", async () => {
  const { state, store } = fixture(seeded());
  const now = new Date("2027-01-06T21:00Z");
  assert.equal((await store.maintain("series", now)).created, 2);
  assert.deepEqual(state.rows.slice(5).map(row => row.startDate), ["2027-01-20", "2027-01-25"]);
  assert.deepEqual(state.rows.slice(5).map(row => row.parentEventId), ["e0", "e1"]);
  assert.equal(state.rows.filter(row => !hasExpired(row, now)).length, 5);
});
test("paused series and passed recurrence end dates never generate replacements", async () => {
  for (const update of [{ isRecurringSuspended: true }, { recurrenceEndDate: "2027-01-18" }]) {
    const { store } = fixture(seeded().map(row => ({ ...row, ...update })));
    assert.equal((await store.maintain("series", new Date("2027-01-04T21:00Z"))).created, 0);
  }
});
test("monthly replacement retains the original day across a clamped final instance", async () => {
  const monthly = { ...template, startDate: "2026-10-31", recurrenceType: "monthly" as const };
  const rows = occurrenceDates(monthly, 5).map((startDate, index) => ({ ...seeded()[0], id: `m${index}`, ...monthly, startDate, recurrenceAnchorDate: monthly.startDate }));
  const { state, store } = fixture(rows as Event[]);
  await store.maintain("series", new Date("2026-10-31T21:00Z"));
  assert.equal(state.rows[5].startDate, "2027-03-31");
});
test("future edits retain distinct dates and each event ID", async () => {
  const original = seeded();
  const { store } = fixture(original);
  const updated = await store.update(original[0], { name: "Changed", startDate: original[0].startDate }, "future");
  assert.deepEqual(updated.map(row => row.startDate), original.map(row => row.startDate));
  assert.deepEqual(updated.map(row => row.id), original.map(row => row.id));
  assert.ok(updated.every(row => row.name === "Changed"));
});
test("moving the series keeps weekday spacing and shifts end dates", async () => {
  const original = seeded().map(row => ({ ...row, endDate: row.startDate }));
  const { store } = fixture(original);
  const updated = await store.update(original[0], { startDate: "2027-01-05", endDate: "2027-01-05" }, "future");
  assert.deepEqual(updated.map(row => row.startDate), ["2027-01-05", "2027-01-07", "2027-01-12", "2027-01-14", "2027-01-19"]);
  assert.ok(updated.every(row => row.endDate === row.startDate));
});
test("future end-date edits cannot silently delete existing occurrences", async () => {
  const original = seeded();
  const { state, store } = fixture(original);
  await assert.rejects(store.update(original[0], { recurrenceEndDate: "2027-01-06" }, "future"), RecurrenceError);
  assert.deepEqual(state.rows, original);
});
test("single scope changes only the selected occurrence", async () => {
  const original = seeded();
  const { state, store } = fixture(original);
  assert.equal((await store.update(original[2], { name: "Single" }, "single")).length, 1);
  assert.equal(state.rows.filter(row => row.name === "Single").length, 1);
});
test("editing only name does not inject recurrence or payment defaults", () => {
  const update = parseEventUpdate({ ...seeded()[0], paymentRequired: true, paymentPolicy: "fixed_immediate", fixedPriceMinor: 500 }, { name: "Changed" });
  assert.equal(update.name, "Changed");
  for (const key of ["recurrenceType", "recurrenceDaysOfWeek", "recurrenceEndDate", "paymentRequired", "paymentPolicy", "isPublished"]) assert.equal(Object.hasOwn(update, key), false);
});
test("caller cannot overwrite series identity, replacement ledger or calendar anchor", () => {
  const update = parseEventUpdate(seeded()[0], { name: "Changed", recurringSeriesId: "other", parentEventId: "other", recurrenceAnchorDate: "2027-09-01", createdById: "other" });
  for (const key of ["recurringSeriesId", "parentEventId", "recurrenceAnchorDate", "createdById"]) assert.equal(Object.hasOwn(update, key), false);
});
test("name-only edits preserve individual one-off date exceptions", async () => {
  const original = seeded();
  original[2].startDate = "2027-01-12";
  const { store } = fixture(original);
  const updated = await store.update(original[0], { name: "Changed" }, "future");
  assert.deepEqual(updated.map(row => row.startDate), original.map(row => row.startDate));
});
test("future edits leave earlier occurrences unchanged", async () => {
  const original = seeded();
  const { state, store } = fixture(original);
  await store.update(original[2], { name: "Later" }, "future");
  assert.deepEqual(state.rows.slice(0, 2), original.slice(0, 2));
  assert.equal(state.rows.filter(row => row.name === "Later").length, 3);
});
test("date shifts move each payment deadline without altering saved fee snapshots", async () => {
  const original = seeded().map(row => ({
    ...row, paymentDeadlineAt: new Date(`${row.startDate}T18:00:00Z`),
    fixedPriceMinor: 500, feeConfiguration: { version: 7 } as any,
  }));
  const { store } = fixture(original);
  const updated = await store.update(original[0], { startDate: "2027-01-05" }, "future");
  assert.ok(updated.every(row => row.paymentDeadlineAt?.toISOString() === `${row.startDate}T18:00:00.000Z`));
  assert.ok(updated.every(row => row.fixedPriceMinor === 500));
  updated.forEach(row => assert.deepEqual(row.feeConfiguration, original[0].feeConfiguration));
});
test("turning recurrence off retains existing distinct dates and prevents generation", async () => {
  const original = seeded();
  const { state, store } = fixture(original);
  await store.update(original[0], { recurrenceType: "none" }, "future");
  assert.deepEqual(state.rows.map(row => row.startDate), original.map(row => row.startDate));
  assert.equal((await store.maintain("series", new Date("2027-01-04T21:00Z"))).created, 0);
});
test("creation skips already expired dates but includes an ongoing multi-day event", async () => {
  const { store } = fixture();
  const daily = { ...template, recurrenceType: "daily" as const };
  const future = await store.create(daily, new Date("2027-01-06T21:00Z"));
  assert.equal(future[0].startDate, "2027-01-07");
  const ongoing = await store.create({ ...daily, endDate: "2027-01-07" }, new Date("2027-01-06T21:00Z"));
  assert.equal(ongoing[0].startDate, "2027-01-04");
});
