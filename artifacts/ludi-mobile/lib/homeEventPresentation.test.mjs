import test from 'node:test';
import assert from 'node:assert/strict';
import { eventDateParts, moneyLabel, nextCardIndex, normalizePaymentSummary, paymentPresentation, voteLabel } from './homeEventPresentation.js';

test('charged maximum and actual residual refunds retain the real net payment', () => {
  const paid = paymentPresentation({ paymentRecord: { status: 'captured', capturedAmountMinor: 1082, refundedAmountMinor: 0 } });
  assert.equal(paid.label, 'Paid');
  assert.equal(paid.paidMinor, 1082);
  const refunded = paymentPresentation({ paymentRecord: { status: 'captured', capturedAmountMinor: 1082, refundedAmountMinor: 200 } });
  assert.equal(refunded.label, 'Part-refunded');
  assert.equal(refunded.paidMinor, 882);
  assert.equal(refunded.refundedMinor, 200);
  assert.equal(moneyLabel(refunded.paidMinor), '£8.82');
});
test('authorisations, setup and agreed prices never count as captured money', () => {
  for (const status of ['hold_created', 'setup_pending', 'setup_complete']) {
    assert.equal(paymentPresentation({ amount: 1082, paymentRecord: { status, agreedAmountMinor: 1082, authorizedAmountMinor: 1082 } }).paidMinor, 0);
  }
  assert.equal(paymentPresentation({ status: 'none', paymentRecord: null }).paidMinor, 0);
  assert.equal(paymentPresentation({ status: 'none', paymentRecord: null }).label, 'Payment due');
});
test('unavailable/malformed amounts cannot silently become zero paid', () => {
  assert.equal(paymentPresentation(null).paidMinor, null);
  assert.equal(paymentPresentation({ paymentRecord: null }, true).paidMinor, null);
  assert.equal(paymentPresentation({ status: 'captured', paymentRecord: null }).paidMinor, null);
  assert.equal(paymentPresentation({ paymentRecord: { status: 'captured', capturedAmountMinor: 0 } }).paidMinor, null);
  assert.equal(paymentPresentation({ paymentRecord: { status: 'captured', capturedAmountMinor: -20 } }).paidMinor, null);
  assert.equal(moneyLabel(null), 'Amount unavailable');
});
test('legacy and manually recorded actual captures remain visible', () => {
  const summary = paymentPresentation({ paymentRecord: { status: 'captured', capturedAmountMinor: 0, finalAmount: '12.50' } });
  assert.equal(summary.paidMinor, 1250);
  assert.equal(paymentPresentation({ paymentRecord: { status: 'captured', finalAmount: '0.00' } }).paidMinor, 0);
});
test('refund pending and confirmed full refunds are distinct', () => {
  const row = { capturedAmountMinor: 1082, refundedAmountMinor: 0 };
  assert.equal(paymentPresentation({ paymentRecord: { ...row, status: 'refund_pending' } }).paidMinor, 1082);
  assert.equal(paymentPresentation({ paymentRecord: { ...row, status: 'refunded', refundedAmountMinor: 1082 } }).paidMinor, 0);
});
test('processing and authentication-required payments are not labelled paid', () => {
  assert.equal(paymentPresentation({ paymentRecord: { status: 'setup_pending', paymentIntentStatus: 'processing' } }).label, 'Processing');
  assert.equal(paymentPresentation({ paymentRecord: { status: 'setup_pending', paymentIntentStatus: 'requires_action' } }).label, 'Action required');
});
test('all vote states remain distinct including no vote', () => {
  assert.equal(voteLabel(null), 'Not voted');
  assert.equal(voteLabel({ status: 'attending' }), 'Can attend');
  assert.equal(voteLabel({ status: 'not_attending' }), "Can't attend");
  assert.equal(voteLabel({ status: 'maybe' }), 'Maybe');
});
test('three advances reach View all and shorter/empty lists are bounded', () => {
  let index = 0;
  for (let i = 0; i < 3; i++) index = nextCardIndex(index, 1, 3);
  assert.equal(index, 3);
  assert.equal(nextCardIndex(index, 1, 3), 3);
  assert.equal(nextCardIndex(0, -1, 3), 0);
  assert.equal(nextCardIndex(0, 1, 0), 0);
  assert.equal(nextCardIndex(0, 3, 1), 1);
  assert.equal(nextCardIndex(0, 3, 2), 2);
});
test('stored event date and time are prominent without shifting calendar labels', () => {
  const result = eventDateParts({ startDate: '2026-10-08', startTime: '18:30:00' });
  assert.equal(result.day, '08');
  assert.equal(result.month, 'Oct');
  assert.equal(result.weekday, 'Thu');
  assert.equal(result.time, '18:30');
  assert.equal(eventDateParts({}).time, 'Time TBC');
});
test('confirmed organisers with no payment record display Organiser/£0', () => {
  for (const summary of [
    { status: 'none', isOrganiser: true, paymentRecord: null, currency: 'gbp' },
    { status: 'none', isOrganiser: true, currency: 'gbp' },
  ]) {
    const shown = paymentPresentation(normalizePaymentSummary(summary));
    assert.equal(shown.label, 'Organiser/£0');
    assert.equal(shown.paidMinor, 0);
    assert.equal(shown.organiserExempt, true);
  }
});
test('an absent record from an older API is unpaid, not an unavailable receipt', () => {
  const shown = paymentPresentation(normalizePaymentSummary({ status: 'none', isOrganiser: false }));
  assert.equal(shown.label, 'Payment due');
  assert.equal(shown.organiserExempt, undefined);
});
test('organiser exemption never hides an existing charge or refund', () => {
  const shown = paymentPresentation({ status: 'captured', isOrganiser: true, paymentRecord: {
    status: 'captured', capturedAmountMinor: 1082, refundedAmountMinor: 200,
  } });
  assert.equal(shown.label, 'Part-refunded');
  assert.equal(shown.paidMinor, 882);
  assert.equal(shown.organiserExempt, undefined);
});
test('role strings, failed fetches and incomplete receipts never imply a £0 exemption', () => {
  assert.equal(paymentPresentation({ status: 'none', isOrganiser: 'true', paymentRecord: null }).label, 'Payment due');
  assert.equal(paymentPresentation({ status: 'none', isOrganiser: true, paymentRecord: null }, true).label, 'Unavailable');
  assert.equal(paymentPresentation({ status: 'captured', isOrganiser: true, paymentRecord: null }).label, 'Unavailable');
  for (const summary of [null, {}, { status: 'captured', isOrganiser: true }, { status: 'none', paymentRecord: 'bad' }]) {
    assert.throws(() => normalizePaymentSummary(summary));
  }
});
