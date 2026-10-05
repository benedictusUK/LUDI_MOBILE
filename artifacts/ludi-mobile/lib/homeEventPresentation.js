// Presentation only. Never derive a successful payment from an event price,
// authorisation, quote or agreed maximum.
export function normalizePaymentSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary) || typeof summary.status !== 'string') {
    throw new Error('Unexpected payment status');
  }
  // Older API builds omitted undefined paymentRecord when no payment existed.
  // Only an explicit "none" status establishes that this is a missing record.
  if (!Object.prototype.hasOwnProperty.call(summary, 'paymentRecord')) {
    if (summary.status !== 'none') throw new Error('Unexpected payment status');
    return { ...summary, paymentRecord: null };
  }
  if (summary.paymentRecord !== null && (typeof summary.paymentRecord !== 'object' || Array.isArray(summary.paymentRecord))) {
    throw new Error('Unexpected payment record');
  }
  return summary;
}
export function paymentPresentation(summary, error) {
  if (error || !summary) return { label: 'Unavailable', paidMinor: null, refundedMinor: 0 };
  const row = summary.paymentRecord;
  if (!row && summary.status === 'none' && summary.isOrganiser === true) {
    return { label: 'Organiser/£0', organiserExempt: true, paidMinor: 0, refundedMinor: 0, currency: summary.currency || 'gbp' };
  }
  if (!row) return summary.status === 'none'
    ? { label: 'Payment due', paidMinor: 0, refundedMinor: 0 }
    : { label: 'Unavailable', paidMinor: null, refundedMinor: 0 };
  const status = row.status;
  const minor = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const decimal = value => {
    if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(amount) ? amount : null;
  };
  let captured = minor(row.capturedAmountMinor);
  // Legacy/manual receipts persist their actual captured value in finalAmount.
  // A zero default in the newer column must not erase that receipt.
  if ((captured === null || captured === 0) && ['captured', 'refunded', 'refund_pending'].includes(status)) {
    captured = decimal(row.finalAmount) ?? (captured > 0 ? captured : null);
  }
  const refunded = minor(row.refundedAmountMinor) || decimal(row.refundAmount) || 0;
  const labels = {
    captured: refunded > 0 ? 'Part-refunded' : 'Paid',
    refunded: 'Refunded', refund_pending: 'Refund pending',
    hold_created: 'Authorised', authorized: 'Authorised',
    setup_pending: 'Payment due', setup_complete: 'Payment due',
    cancelled: 'Cancelled', failed: 'Payment failed',
  };
  const noCapture = ['hold_created', 'authorized', 'setup_pending', 'setup_complete', 'cancelled', 'failed'].includes(status);
  // Only confirmed captures/receipts establish a paid amount.
  const paidMinor = status === 'refunded' ? 0
    : captured !== null ? Math.max(0, captured - refunded)
    : noCapture ? 0 : null;
  const label = status !== 'captured' && row.paymentIntentStatus === 'processing' ? 'Processing'
    : status !== 'captured' && row.paymentIntentStatus === 'requires_action' ? 'Action required'
    : labels[status] || 'Status unavailable';
  return { label, paidMinor, refundedMinor: refunded, currency: row.currency || 'gbp' };
}
export function moneyLabel(minor, currency = 'gbp') {
  if (minor === null || minor === undefined) return 'Amount unavailable';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return 'Amount unavailable';
  }
}
export function voteLabel(attendance) {
  return { attending: 'Can attend', not_attending: "Can't attend", maybe: 'Maybe' }[attendance?.status] || 'Not voted';
}
export function eventDateParts(event) {
  // Keep the stored calendar/time labels consistent with existing event details.
  const date = new Date(`${String(event.startDate).slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return { day: '—', weekday: 'TBC', month: '', time: event.startTime || 'Time TBC' };
  const format = options => date.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
  return {
    day: format({ day: '2-digit' }), weekday: format({ weekday: 'short' }),
    month: format({ month: 'short' }), full: format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: event.startTime?.slice(0, 5) || 'Time TBC',
  };
}
export function nextCardIndex(index, delta, eventCount) {
  return Math.max(0, Math.min(Math.min(3, eventCount), index + delta));
}
