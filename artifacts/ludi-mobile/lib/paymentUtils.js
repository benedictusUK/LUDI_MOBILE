export function calculateTotalAmount(baseAmount, platformCharges = [], fees) {
  const base = typeof baseAmount === 'string' ? parseFloat(baseAmount) : baseAmount;
  if (isNaN(base) || base <= 0) {
    return { breakdown: [], total: 0, totalCharges: 0, stripeFee: 0 };
  }

  const baseMinor = Math.round(base * 100);
  let totalChargesMinor = 0;
  const breakdown = [{ name: 'Base Amount', amount: baseMinor / 100, type: 'base' }];

  const platform = fees ? [{ name: 'Platform charge', type: 'percentage', value: String(fees.platformBasisPoints / 10000) }]
    : platformCharges.filter(c => c.isActive !== false && !c.name.startsWith('stripe_processing_'));
  platform.forEach((charge) => {
    let chargeAmount = 0;
    if (charge.type === 'percentage') {
      chargeAmount = Math.ceil(baseMinor * Math.round(parseFloat(charge.value) * 10000) / 10000) / 100;
    } else if (charge.type === 'fixed') {
      chargeAmount = parseFloat(charge.value);
    }
    if (chargeAmount > 0) {
      breakdown.push({
        name: charge.description || charge.name,
        amount: chargeAmount,
        type: charge.type,
      });
      totalChargesMinor += Math.round(chargeAmount * 100);
    }
  });

  const rate = fees ? fees.stripeBasisPoints / 10000 : Number(platformCharges.find(c => c.name === 'stripe_processing_percentage')?.value || 0);
  const fixedMinor = fees ? fees.stripeFixedMinor : Math.round(Number(platformCharges.find(c => c.name === 'stripe_processing_fixed')?.value || 0) * 100);
  const stripeMinor = Math.ceil((baseMinor + totalChargesMinor) * Math.round(rate * 10000) / 10000) + fixedMinor;
  const stripeFee = stripeMinor / 100;
  if (stripeMinor > 0) {
    breakdown.push({
      name: 'Processing charge',
      amount: stripeFee,
      type: 'stripe_fee',
    });
    totalChargesMinor += stripeMinor;
  }

  return { breakdown, total: (baseMinor + totalChargesMinor) / 100, totalCharges: totalChargesMinor / 100, stripeFee };
}

export function calculateStripeFee(amount, platformCharges = []) {
  const base = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(base) || base <= 0) return 0;
  const rate = Number(platformCharges.find(c => c.name === 'stripe_processing_percentage')?.value || 0);
  const fixedMinor = Math.round(Number(platformCharges.find(c => c.name === 'stripe_processing_fixed')?.value || 0) * 100);
  return (Math.ceil(Math.round(base * 100) * Math.round(rate * 10000) / 10000) + fixedMinor) / 100;
}

export function formatCurrency(amount) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '£0.00';
  return `£${value.toFixed(2)}`;
}
