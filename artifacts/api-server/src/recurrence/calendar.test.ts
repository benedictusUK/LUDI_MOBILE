import assert from "node:assert/strict";
import { test } from "node:test";
import { hasExpired, occurrenceDates, occurrenceOnOrAfter, RecurrenceError, revisedSchedule, shiftedEndDate } from "./calendar";

const weekly = { startDate: "2027-01-04", startTime: "19:00", endTime: "20:00", recurrenceType: "weekly", recurrenceDaysOfWeek: ["wednesday", "monday"] };
test("daily dates are distinct across daylight-saving changes", () => {
  assert.deepEqual(occurrenceDates({ ...weekly, startDate: "2027-03-27", recurrenceType: "daily" }, 5), ["2027-03-27", "2027-03-28", "2027-03-29", "2027-03-30", "2027-03-31"]);
});
test("all selected weekdays are honoured chronologically, regardless of selection order", () => {
  assert.deepEqual(occurrenceDates(weekly, 5), ["2027-01-04", "2027-01-06", "2027-01-11", "2027-01-13", "2027-01-18"]);
});
test("weekly first occurrence is the next matching weekday, not the first selected value", () => {
  assert.equal(occurrenceOnOrAfter(weekly, "2027-01-05"), "2027-01-06");
});
test("weekly without explicit weekdays defaults to the start weekday without looping", () => {
  assert.deepEqual(occurrenceDates({ ...weekly, recurrenceDaysOfWeek: [] }, 3), ["2027-01-04", "2027-01-11", "2027-01-18"]);
});
test("monthly preserves its original day after short months", () => {
  assert.deepEqual(occurrenceDates({ ...weekly, startDate: "2027-01-31", recurrenceType: "monthly" }, 5), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
});
test("monthly continuation uses the original anchor even after a February instance", () => {
  assert.equal(occurrenceOnOrAfter({ ...weekly, startDate: "2027-02-28", recurrenceAnchorDate: "2026-10-31", recurrenceType: "monthly" }, "2027-03-01"), "2027-03-31");
});
test("monthly respects leap years", () => {
  assert.deepEqual(occurrenceDates({ ...weekly, startDate: "2028-01-31", recurrenceType: "monthly" }, 3), ["2028-01-31", "2028-02-29", "2028-03-31"]);
});
test("recurrence end date is inclusive and limits initial occurrences", () => {
  assert.deepEqual(occurrenceDates({ ...weekly, recurrenceEndDate: "2027-01-11" }, 5), ["2027-01-04", "2027-01-06", "2027-01-11"]);
});
test("invalid dates, weekdays and patterns fail explicitly", () => {
  assert.throws(() => occurrenceDates({ ...weekly, startDate: "2027-02-30" }, 5), RecurrenceError);
  assert.throws(() => occurrenceDates({ ...weekly, recurrenceDaysOfWeek: ["noday"] }, 5), RecurrenceError);
  assert.throws(() => occurrenceDates({ ...weekly, recurrenceType: "custom" }, 5), RecurrenceError);
});
test("end dates retain multi-day duration", () => {
  assert.equal(shiftedEndDate({ ...weekly, endDate: "2027-01-06" }, "2027-01-11"), "2027-01-13");
});
test("expiry uses end, not start, and accepts seconds", () => {
  const event = { ...weekly, endTime: "20:00:30" };
  assert.equal(hasExpired(event, new Date("2027-01-04T19:30:00Z")), false);
  assert.equal(hasExpired(event, new Date("2027-01-04T20:00:29Z")), false);
  assert.equal(hasExpired(event, new Date("2027-01-04T20:00:30Z")), true);
});
test("expiry observes UK daylight-saving time", () => {
  const event = { ...weekly, startDate: "2027-03-28", startTime: "09:00", endTime: "10:00" };
  assert.equal(hasExpired(event, new Date("2027-03-28T08:59:59Z")), false);
  assert.equal(hasExpired(event, new Date("2027-03-28T09:00:00Z")), true);
  assert.equal(hasExpired({ ...event, startDate: "2027-10-31" }, new Date("2027-10-31T09:59:59Z")), false);
  assert.equal(hasExpired({ ...event, startDate: "2027-10-31" }, new Date("2027-10-31T10:00:00Z")), true);
});
test("an overnight event is not expired on its start day", () => {
  const event = { ...weekly, startTime: "23:00", endTime: "01:00" };
  assert.equal(hasExpired(event, new Date("2027-01-04T23:30:00Z")), false);
  assert.equal(hasExpired(event, new Date("2027-01-05T01:00:00Z")), true);
});
test("an event without an end time lasts through its end day", () => {
  const event = { ...weekly, endDate: "2027-01-05", endTime: null };
  assert.equal(hasExpired(event, new Date("2027-01-05T23:59:58Z")), false);
  assert.equal(hasExpired(event, new Date("2027-01-05T23:59:59Z")), true);
});
test("moving a weekly series shifts unchanged weekdays too", () => {
  const revised = revisedSchedule(weekly, { startDate: "2027-01-05" });
  assert.deepEqual(revised.recurrenceDaysOfWeek, ["thursday", "tuesday"]);
  assert.deepEqual(occurrenceDates(revised, 3), ["2027-01-05", "2027-01-07", "2027-01-12"]);
});
test("explicitly changed weekdays take priority when revising a series", () => {
  const revised = revisedSchedule(weekly, { startDate: "2027-01-05", recurrenceDaysOfWeek: ["friday"] });
  assert.deepEqual(occurrenceDates(revised, 3), ["2027-01-08", "2027-01-15", "2027-01-22"]);
});
