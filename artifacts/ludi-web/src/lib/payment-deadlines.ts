const DAY = 86400000;
const HOUR = 3600000;
export const MAX_SPAN_MS = 5 * DAY;
export const DEFAULT_OPENS = { days: "2", hours: "0" };
export const DEFAULT_COLLECT = { days: "1", hours: "0" };

const withSeconds = (t: string) => (/^\d{1,2}:\d{2}$/.test(t) ? `${t.padStart(5, "0")}:00` : t);

/** Event start as UTC instant (backend convention). */
export function eventStartUtc(startDate?: string | null, startTime?: string | null): Date | null {
  if (!startDate || !startTime) return null;
  const d = new Date(`${startDate}T${withSeconds(startTime)}Z`);
  return isNaN(d.getTime()) ? null : d;
}
/** Event end as UTC instant: endDate||startDate, endTime||23:59:59. */
export function eventEndUtc(startDate?: string | null, endDate?: string | null, endTime?: string | null): Date | null {
  const date = endDate || startDate;
  if (!date) return null;
  const d = new Date(`${date}T${endTime ? withSeconds(endTime) : "23:59:59"}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function msToOffset(ms: number) {
  const m = Math.max(0, Math.round(ms / HOUR) * HOUR);
  return { days: String(Math.floor(m / DAY)), hours: String(Math.floor((m % DAY) / HOUR)) };
}
export function hydrateOffsets(
  ev: { startDate?: string | null; startTime?: string | null; endDate?: string | null; endTime?: string | null },
  opensIso?: string | null,
  dueIso?: string | null,
) {
  const start = eventStartUtc(ev.startDate, ev.startTime);
  const end = eventEndUtc(ev.startDate, ev.endDate, ev.endTime);
  const o = opensIso ? new Date(opensIso) : null;
  const c = dueIso ? new Date(dueIso) : null;
  const opens = start && o && !isNaN(+o) ? msToOffset(+start - +o) : DEFAULT_OPENS;
  const collect = end && c && !isNaN(+c) ? msToOffset(+c - +end) : DEFAULT_COLLECT;
  return { opens, collect };
}

const parseUnit = (v: string, max?: number) => {
  if (!/^\d+$/.test((v ?? "").trim())) return null;
  const n = Number(v);
  return max !== undefined && n > max ? null : n;
};

export interface OffsetInput { opensDays: string; opensHours: string; collectDays: string; collectHours: string }

/** Returns { error } or { opensAt, completionDueAt } ISO strings. */
export function computeFlexibleDeadlines(
  ev: { startDate?: string; startTime?: string; endDate?: string; endTime?: string },
  o: OffsetInput,
): { error: string } | { opensAt: string; completionDueAt: string } {
  const od = parseUnit(o.opensDays), oh = parseUnit(o.opensHours, 23);
  const cd = parseUnit(o.collectDays), ch = parseUnit(o.collectHours, 23);
  if (od === null || cd === null) return { error: "Days must be whole numbers of 0 or more" };
  if (oh === null || ch === null) return { error: "Hours must be whole numbers from 0 to 23" };
  const start = eventStartUtc(ev.startDate, ev.startTime);
  const end = eventEndUtc(ev.startDate, ev.endDate, ev.endTime);
  if (!start || !end) return { error: "Set the event start date and time first" };
  if (end < start) return { error: "Event end must be on or after its start" };
  const before = od * DAY + oh * HOUR;
  const after = cd * DAY + ch * HOUR;
  if (after <= 0) return { error: "Collect by must be at least 1 hour after the event ends" };
  return { opensAt: new Date(+start - before).toISOString(), completionDueAt: new Date(+end + after).toISOString() };
}

export function memberDisplayName(user: any, currentUserId?: string | null) {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const base = full || user?.username || (user?.email ? String(user.email).split("@")[0] : "") || "Unnamed member";
  return currentUserId && user?.id === currentUserId ? `${base} (You)` : base;
}
