export const POLICY_OPTIONS = [
  { value: 'flexible_post_event', label: 'Flexible', help: 'Players pay the maximum venue share plus fees upfront. Unused venue cost is refunded; both fee amounts stay fixed.' },
  { value: 'fixed_immediate', label: 'Fixed', help: 'Players are charged the displayed price upfront. Fees come out of this price, not on top.' },
  { value: 'fixed_threshold', label: 'Fixed + minimum', help: 'Charged upfront; refunded if fewer than the minimum have paid by the deadline.' },
];

export const isFixedPolicy = (p) => p === 'fixed_immediate' || p === 'fixed_threshold';

export const effectivePolicy = (event) =>
  event?.paymentPolicy && event.paymentPolicy !== 'none' ? event.paymentPolicy : 'flexible_post_event';

export const policySummary = (policy, amountPounds, minPaid, upfront = false) => {
  const amt = `£${Number(amountPounds || 0).toFixed(2)} GBP`;
  if (policy === 'fixed_immediate') return `Fixed price ${amt}, charged upfront`;
  if (policy === 'fixed_threshold') return `Fixed price ${amt}, refunded if fewer than ${minPaid || 'the minimum'} pay`;
  return upfront ? `Flexible: pay ${amt} upfront; unused venue cost refunded, original fees fixed` : `Flexible: hold up to ${amt}, settled after the event`;
};

const pad = (n) => String(n).padStart(2, '0');
export const toLocalText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const parseLocalText = (t) => {
  if (!t || !t.trim()) return null;
  const m = t.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  if (+m[4] > 23 || +m[5] > 59 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(d.getTime()) || d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1
    || d.getDate() !== +m[3] || d.getHours() !== +m[4] || d.getMinutes() !== +m[5]
    ? undefined : d;
};

const DAY = 86400000;
const HOUR = 3600000;
const withSeconds = (t) => (/^\d{1,2}:\d{2}$/.test(t) ? `${t.padStart(5, '0')}:00` : t);

// Server convention: event times are UTC instants.
export const eventStartUtc = (startDate, startTime) => {
  if (!startDate || !startTime) return null;
  const d = new Date(`${startDate}T${withSeconds(startTime)}Z`);
  return isNaN(d.getTime()) ? null : d;
};
export const eventEndUtc = (startDate, endDate, endTime) => {
  const date = endDate || startDate;
  if (!date) return null;
  const d = new Date(`${date}T${endTime ? withSeconds(endTime) : '23:59:59'}Z`);
  return isNaN(d.getTime()) ? null : d;
};
export const eventWindow = (f) => ({
  start: eventStartUtc(f?.startDate, f?.startTime),
  end: eventEndUtc(f?.startDate, f?.endDate, f?.endTime),
});

const msToOffset = (ms) => {
  const m = Math.max(0, Math.round(ms / HOUR) * HOUR);
  return { days: String(Math.floor(m / DAY)), hours: String(Math.floor((m % DAY) / HOUR)) };
};

export const policyFieldsFromEvent = (event) => {
  const { start, end } = eventWindow(event);
  const o = event?.authorizationOpensAt ? new Date(event.authorizationOpensAt) : null;
  const c = event?.completionDueAt ? new Date(event.completionDueAt) : null;
  const opens = start && o && !isNaN(o) ? msToOffset(start - o) : { days: '2', hours: '0' };
  const collect = end && c && !isNaN(c) ? msToOffset(c - end) : { days: '1', hours: '0' };
  return {
    paymentPolicy: effectivePolicy(event),
    fixedPrice: event?.fixedPriceMinor != null ? (event.fixedPriceMinor / 100).toFixed(2) : '',
    minimumPaidParticipants: event?.minimumPaidParticipants != null ? String(event.minimumPaidParticipants) : '',
    paymentDeadlineText: toLocalText(event?.paymentDeadlineAt),
    authorizationOpensText: toLocalText(event?.authorizationOpensAt),
    opensDays: opens.days, opensHours: opens.hours,
    collectDays: collect.days, collectHours: collect.hours,
  };
};

export const defaultPolicyFields = policyFieldsFromEvent(null);

const pence = (v) => Math.round(parseFloat(v || '0') * 100);
const unit = (v, max) => {
  if (!/^\d+$/.test(String(v ?? '').trim())) return null;
  const n = Number(v);
  return max !== undefined && n > max ? null : n;
};

// Returns { error } or { opensAt: Date, dueAt: Date }
export const computeFlexibleDeadlines = (f, start, end) => {
  const od = unit(f.opensDays), oh = unit(f.opensHours, 23);
  const cd = unit(f.collectDays), ch = unit(f.collectHours, 23);
  if (od === null || cd === null) return { error: 'Days must be whole numbers of 0 or more' };
  if (oh === null || ch === null) return { error: 'Hours must be whole numbers from 0 to 23' };
  if (!start || !end) return { error: 'Set the event start date and time first' };
  if (end < start) return { error: 'Event end must be on or after its start' };
  const before = od * DAY + oh * HOUR;
  const after = cd * DAY + ch * HOUR;
  if (after <= 0) return { error: 'Collect by must be at least 1 hour after the event ends' };
  return { opensAt: new Date(start.getTime() - before), dueAt: new Date(end.getTime() + after) };
};

// Returns an error string or null. eventStart/eventEnd are UTC Dates.
export const validatePolicy = (f, eventStart, eventEnd) => {
  if (!f.paymentRequired) return null;
  if (f.paymentPolicy === 'flexible_post_event') {
    if (!(parseFloat(f.maxPlayerPayment) > 0)) return 'Max player payment must be greater than 0';
    const r = computeFlexibleDeadlines(f, eventStart, eventEnd);
    return r.error || null;
  }
  const opens = parseLocalText(f.authorizationOpensText);
  const deadline = parseLocalText(f.paymentDeadlineText);
  if (opens === undefined || deadline === undefined) return 'Choose a date and a time (HH:MM) for payment dates';
  const p = pence(f.fixedPrice);
  if (!Number.isSafeInteger(p) || p <= 0) return 'Fixed price must be a positive amount in pounds';
  if (f.paymentPolicy === 'fixed_threshold') {
    const min = parseInt(f.minimumPaidParticipants, 10);
    if (!Number.isInteger(min) || min < 1) return 'Minimum paid players must be a positive whole number';
    if (f.maxParticipants && min > parseInt(f.maxParticipants, 10)) return 'Minimum paid players cannot exceed max players';
    if (!deadline) return 'Payment deadline is required';
    if (eventStart && deadline > eventStart) return 'Payment deadline must be on or before the event start';
  }
  if (opens && deadline && opens >= deadline) return 'Authorisation opening must be before the payment deadline';
  return null;
};

export const buildPolicyPayload = (f, eventStart, eventEnd) => {
  if (!f.paymentRequired) {
    return {
      paymentRequired: false, paymentPolicy: 'none', fixedPriceMinor: null, minimumPaidParticipants: null,
      paymentDeadlineAt: null, authorizationOpensAt: null, completionDueAt: null,
    };
  }
  const iso = (t) => { const d = parseLocalText(t); return d ? d.toISOString() : null; };
  if (isFixedPolicy(f.paymentPolicy)) {
    const p = pence(f.fixedPrice);
    return {
      paymentRequired: true, paymentPolicy: f.paymentPolicy, currency: 'gbp', fixedPriceMinor: p,
      maxPlayerPayment: (p / 100).toFixed(2),
      minimumPaidParticipants: f.paymentPolicy === 'fixed_threshold' ? parseInt(f.minimumPaidParticipants, 10) : null,
      paymentDeadlineAt: iso(f.paymentDeadlineText), authorizationOpensAt: iso(f.authorizationOpensText),
      completionDueAt: null, finalVenueCost: null,
    };
  }
  const r = computeFlexibleDeadlines(f, eventStart, eventEnd);
  return {
    paymentRequired: true, paymentPolicy: 'flexible_post_event', currency: 'gbp',
    maxPlayerPayment: f.maxPlayerPayment, finalVenueCost: f.finalVenueCost || null,
    fixedPriceMinor: null, minimumPaidParticipants: null, paymentDeadlineAt: null,
    authorizationOpensAt: r.opensAt ? r.opensAt.toISOString() : null,
    completionDueAt: r.dueAt ? r.dueAt.toISOString() : null,
  };
};
