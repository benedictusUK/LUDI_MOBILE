export const POLICY_OPTIONS = [
  { value: 'flexible_post_event', label: 'Flexible', help: 'Players authorise a cap in GBP; the actual cost is settled after the event.' },
  { value: 'fixed_immediate', label: 'Fixed', help: 'Players are charged the displayed price upfront. Fees come out of this price, not on top.' },
  { value: 'fixed_threshold', label: 'Fixed + minimum', help: 'Charged upfront; refunded if fewer than the minimum have paid by the deadline.' },
];

export const isFixedPolicy = (p) => p === 'fixed_immediate' || p === 'fixed_threshold';

export const effectivePolicy = (event) =>
  event?.paymentPolicy && event.paymentPolicy !== 'none' ? event.paymentPolicy : 'flexible_post_event';

export const policySummary = (policy, amountPounds, minPaid) => {
  const amt = `£${Number(amountPounds || 0).toFixed(2)} GBP`;
  if (policy === 'fixed_immediate') return `Fixed price ${amt}, charged upfront`;
  if (policy === 'fixed_threshold') return `Fixed price ${amt}, refunded if fewer than ${minPaid || 'the minimum'} pay`;
  return `Flexible: hold up to ${amt}, settled after the event`;
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
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(d.getTime()) ? undefined : d;
};

export const policyFieldsFromEvent = (event) => ({
  paymentPolicy: effectivePolicy(event),
  fixedPrice: event?.fixedPriceMinor != null ? (event.fixedPriceMinor / 100).toFixed(2) : '',
  minimumPaidParticipants: event?.minimumPaidParticipants != null ? String(event.minimumPaidParticipants) : '',
  paymentDeadlineText: toLocalText(event?.paymentDeadlineAt),
  authorizationOpensText: toLocalText(event?.authorizationOpensAt),
  completionDueText: toLocalText(event?.completionDueAt),
});

export const defaultPolicyFields = policyFieldsFromEvent(null);

const pence = (v) => Math.round(parseFloat(v || '0') * 100);

// Returns an error string or null
export const validatePolicy = (f, eventStart, eventEnd) => {
  if (!f.paymentRequired) return null;
  const opens = parseLocalText(f.authorizationOpensText);
  const deadline = parseLocalText(f.paymentDeadlineText);
  const due = parseLocalText(f.completionDueText);
  if (opens === undefined || deadline === undefined || due === undefined) return 'Use the format YYYY-MM-DD HH:MM for payment dates';
  if (f.paymentPolicy === 'flexible_post_event') {
    if (!(parseFloat(f.maxPlayerPayment) > 0)) return 'Max player payment must be greater than 0';
    if (due) {
      if (eventEnd && due <= eventEnd) return 'Collect-by time must be after the event ends';
      if (opens && due.getTime() - opens.getTime() > 5 * 86400000) return 'Collect-by time must be within 5 days of authorisation opening';
    }
    return null;
  }
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

export const buildPolicyPayload = (f) => {
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
  return {
    paymentRequired: true, paymentPolicy: 'flexible_post_event', currency: 'gbp',
    maxPlayerPayment: f.maxPlayerPayment, finalVenueCost: f.finalVenueCost || null,
    fixedPriceMinor: null, minimumPaidParticipants: null, paymentDeadlineAt: null,
    authorizationOpensAt: iso(f.authorizationOpensText), completionDueAt: iso(f.completionDueText),
  };
};
