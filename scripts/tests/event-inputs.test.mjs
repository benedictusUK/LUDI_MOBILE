import assert from "node:assert/strict";
import { test } from "node:test";
import * as web from "../../artifacts/ludi-web/src/lib/payment-deadlines.ts";
import * as mobile from "../../artifacts/ludi-mobile/lib/paymentPolicy.js";
import { monthCells, toYmd, parseYmd } from "../../artifacts/ludi-mobile/lib/calendar.js";

const event = { startDate: "2026-10-17", startTime: "18:00", endDate: "2026-10-17", endTime: "20:00" };
const defaults = { opensDays: "2", opensHours: "0", collectDays: "1", collectHours: "0" };

const calculators = {
  web: (ev, offsets) => web.computeFlexibleDeadlines(ev, offsets),
  mobile: (ev, offsets) => {
    const { start, end } = mobile.eventWindow(ev);
    const result = mobile.computeFlexibleDeadlines(offsets, start, end);
    return result.error ? result : {
      opensAt: result.opensAt.toISOString(),
      completionDueAt: result.dueAt.toISOString(),
    };
  },
};

for (const [name, calculate] of Object.entries(calculators)) {
  test(`${name}: default deadlines are relative to UTC start and end`, () => {
    assert.deepEqual(calculate(event, defaults), {
      opensAt: "2026-10-15T18:00:00.000Z",
      completionDueAt: "2026-10-18T20:00:00.000Z",
    });
  });

  test(`${name}: nonzero days and hours are combined in both directions`, () => {
    assert.deepEqual(calculate(event, { ...defaults, opensHours: "3", collectHours: "2" }), {
      opensAt: "2026-10-15T15:00:00.000Z",
      completionDueAt: "2026-10-18T22:00:00.000Z",
    });
  });

  test(`${name}: changing the event day recomputes both deadlines`, () => {
    assert.deepEqual(calculate({ ...event, startDate: "2026-10-18", endDate: "2026-10-18" }, defaults), {
      opensAt: "2026-10-16T18:00:00.000Z",
      completionDueAt: "2026-10-19T20:00:00.000Z",
    });
  });

  test(`${name}: missing end values use the server's end-of-day convention`, () => {
    assert.equal(calculate({ ...event, endDate: "", endTime: "" }, defaults).completionDueAt,
      "2026-10-18T23:59:59.000Z");
  });

  test(`${name}: month/year transitions do not change the offset`, () => {
    const ev = { ...event, startDate: "2026-12-31", endDate: "2026-12-31" };
    assert.equal(calculate(ev, defaults).completionDueAt, "2027-01-01T20:00:00.000Z");
  });

  for (const [field, value] of [
    ["opensDays", "-1"], ["collectDays", "1.5"], ["opensHours", "24"],
    ["collectHours", "-1"], ["opensDays", ""],
  ]) {
    test(`${name}: rejects invalid ${field}=${JSON.stringify(value)}`, () => {
      assert.ok(calculate(event, { ...defaults, [field]: value }).error);
    });
  }

  test(`${name}: rejects collection at the exact event end`, () => {
    assert.ok(calculate(event, { ...defaults, collectDays: "0", collectHours: "0" }).error);
  });

  test(`${name}: upfront payments allow events lasting beyond the old hold window`, () => {
    assert.ok(!calculate({ ...event, endDate: "2026-10-20" }, defaults).error);
  });

  test(`${name}: upfront payments allow settlement offsets beyond five days`, () => {
    const ev = { ...event, endTime: "18:00" };
    assert.ok(!calculate(ev, { ...defaults, collectDays: "3" }).error);
    assert.ok(!calculate(ev, { ...defaults, collectDays: "3", collectHours: "1" }).error);
  });

  test(`${name}: rejects an event ending before it starts`, () => {
    assert.ok(calculate({ ...event, endTime: "17:00" }, defaults).error);
  });
}

test("web and mobile restore stored deadlines into the same editable offsets", () => {
  const stored = {
    ...event,
    authorizationOpensAt: "2026-10-15T15:00:00.000Z",
    completionDueAt: "2026-10-18T22:00:00.000Z",
  };
  const w = web.hydrateOffsets(stored, stored.authorizationOpensAt, stored.completionDueAt);
  const m = mobile.policyFieldsFromEvent(stored);
  assert.deepEqual(w, { opens: { days: "2", hours: "3" }, collect: { days: "1", hours: "2" } });
  assert.deepEqual([m.opensDays, m.opensHours, m.collectDays, m.collectHours], ["2", "3", "1", "2"]);
});

test("mobile serialises flexible offsets as the API's existing ISO fields", () => {
  const form = { ...event, ...defaults, paymentRequired: true, paymentPolicy: "flexible_post_event", maxPlayerPayment: "20" };
  const { start, end } = mobile.eventWindow(form);
  const payload = mobile.buildPolicyPayload(form, start, end);
  assert.equal(payload.authorizationOpensAt, "2026-10-15T18:00:00.000Z");
  assert.equal(payload.completionDueAt, "2026-10-18T20:00:00.000Z");
  assert.equal(payload.paymentDeadlineAt, null);
  assert.equal(payload.paymentPolicy, "flexible_post_event");
});

test("turning payments off explicitly clears previously stored payment windows", () => {
  const payload = mobile.buildPolicyPayload({ paymentRequired: false });
  assert.equal(payload.paymentPolicy, "none");
  for (const key of ["authorizationOpensAt", "completionDueAt", "paymentDeadlineAt"]) {
    assert.equal(payload[key], null);
  }
});

test("fixed payment dates reject invalid clocks and dates instead of rolling them over", () => {
  for (const text of ["2026-10-17 24:00", "2026-10-17 18:60", "2026-02-30 18:00"]) {
    assert.equal(mobile.parseLocalText(text), undefined);
  }
  assert.ok(mobile.parseLocalText("2026-10-17 18:30") instanceof Date);
});

test("organiser names support usernames and partial names, with the user's identity marked", () => {
  assert.equal(web.memberDisplayName({ id: "user-id", username: "captain" }, "user-id"), "captain (You)");
  assert.equal(web.memberDisplayName({ firstName: "Alex", lastName: null }), "Alex");
  assert.equal(web.memberDisplayName({ firstName: null, lastName: "Lane" }), "Lane");
});

test("calendar month grids handle leap years and Monday-first navigation", () => {
  assert.equal(monthCells(2028, 2).filter(Boolean).length, 29);
  assert.equal(monthCells(2027, 2).filter(Boolean).length, 28);
  assert.equal(monthCells(2026, 6)[0], 1);
  assert.equal(monthCells(2026, 6).length % 7, 0);
  assert.equal(toYmd(2026, 10, 3), "2026-10-03");
  assert.deepEqual(parseYmd("2026-10-03"), { year: 2026, month: 10, day: 3 });
});