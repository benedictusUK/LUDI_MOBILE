const DAY = 86400000;
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const londonClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export const RECURRING_WINDOW = 5;
export class RecurrenceError extends Error {}
export type Schedule = {
  startDate: string;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  recurrenceType?: string | null;
  recurrenceDaysOfWeek?: string[] | null;
  recurrenceEndDate?: string | null;
  recurrenceAnchorDate?: string | null;
};

export function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RecurrenceError("Use a valid event date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw new RecurrenceError("Use a valid event date.");
  return +date / DAY;
}
export function addDays(value: string, offset: number): string {
  return new Date((dayNumber(value) + offset) * DAY).toISOString().slice(0, 10);
}
export function shiftedEndDate(template: Schedule, startDate: string): string | null {
  if (!template.endDate) return null;
  const duration = dayNumber(template.endDate) - dayNumber(template.startDate);
  if (duration < 0) throw new RecurrenceError("The end date cannot be before the start date.");
  return addDays(startDate, duration);
}
export function weeklyDays(schedule: Schedule): string[] {
  const selected = schedule.recurrenceDaysOfWeek?.length
    ? [...new Set(schedule.recurrenceDaysOfWeek.map(day => day.toLowerCase()))]
    : [DAYS[new Date(dayNumber(schedule.recurrenceAnchorDate || schedule.startDate) * DAY).getUTCDay()]];
  if (selected.some(day => !DAYS.includes(day))) throw new RecurrenceError("Choose valid weekdays.");
  return selected;
}
// Calendar-only UTC arithmetic avoids server timezone and daylight-saving drift.
export function occurrenceOnOrAfter(schedule: Schedule, from: string): string | null {
  dayNumber(from);
  const anchor = schedule.recurrenceAnchorDate || schedule.startDate;
  dayNumber(anchor);
  let candidate = from < schedule.startDate ? schedule.startDate : from;
  switch (schedule.recurrenceType) {
    case "daily": break;
    case "weekly": {
      const allowed = weeklyDays(schedule);
      for (let offset = 0; offset < 7; offset++) {
        const date = addDays(candidate, offset);
        if (allowed.includes(DAYS[new Date(dayNumber(date) * DAY).getUTCDay()])) { candidate = date; break; }
      }
      break;
    }
    case "monthly": {
      const wantedDay = Number(anchor.slice(8, 10));
      let year = Number(candidate.slice(0, 4));
      let month = Number(candidate.slice(5, 7)) - 1;
      const inMonth = () => {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return new Date(Date.UTC(year, month, Math.min(wantedDay, lastDay))).toISOString().slice(0, 10);
      };
      let date = inMonth();
      if (date < candidate) { month++; if (month === 12) { month = 0; year++; } date = inMonth(); }
      candidate = date;
      break;
    }
    case "none": return from <= schedule.startDate ? schedule.startDate : null;
    default: throw new RecurrenceError("Choose a valid recurrence pattern.");
  }
  if (schedule.recurrenceEndDate) {
    dayNumber(schedule.recurrenceEndDate);
    if (candidate > schedule.recurrenceEndDate) return null;
  }
  return candidate;
}
export function occurrenceDates(schedule: Schedule, count: number, from = schedule.startDate): string[] {
  const dates: string[] = [];
  let candidate = occurrenceOnOrAfter(schedule, from);
  while (candidate && dates.length < count) {
    dates.push(candidate);
    candidate = occurrenceOnOrAfter(schedule, addDays(candidate, 1));
  }
  return dates;
}
export function londonNow(now: Date): string {
  const parts = londonClock.formatToParts(now);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function clock(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || "0") > 59) throw new RecurrenceError("Use a valid event time.");
  return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
}
export function hasExpired(event: Schedule, now: Date): boolean {
  let endDate = event.endDate || event.startDate;
  dayNumber(endDate);
  const endTime = event.endTime ? clock(event.endTime) : "23:59:59";
  if (!event.endDate && event.endTime && event.startTime && endTime < clock(event.startTime)) endDate = addDays(endDate, 1);
  return `${endDate}T${endTime}` <= londonNow(now);
}
export function revisedSchedule(event: Schedule, updates: Partial<Schedule>): Schedule {
  const revised = { ...event, ...updates };
  const moved = revised.startDate !== event.startDate;
  const changedType = revised.recurrenceType !== event.recurrenceType;
  const sameDays = (a?: string[] | null, b?: string[] | null) => [...(a || [])].sort().join() === [...(b || [])].sort().join();
  if (moved && revised.recurrenceType === "weekly" && sameDays(updates.recurrenceDaysOfWeek ?? event.recurrenceDaysOfWeek, event.recurrenceDaysOfWeek)) {
    const offset = dayNumber(revised.startDate) - dayNumber(event.startDate);
    revised.recurrenceDaysOfWeek = weeklyDays(event).map(day => DAYS[((DAYS.indexOf(day) + offset) % 7 + 7) % 7]);
  }
  revised.recurrenceAnchorDate = moved || changedType ? revised.startDate : event.recurrenceAnchorDate || event.startDate;
  return revised;
}
