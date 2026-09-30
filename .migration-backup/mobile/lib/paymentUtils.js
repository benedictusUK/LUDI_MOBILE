// Stripe processing fee: 2.9% + 30p (UK)
const STRIPE_PERCENTAGE_FEE = 0.029; // 2.9%
const STRIPE_FIXED_FEE = 0.30; // 30p

export function calculateTotalAmount(baseAmount, platformCharges = [], includeStripeFee = true) {
  const base = typeof baseAmount === 'string' ? parseFloat(baseAmount) : baseAmount;
  if (isNaN(base) || base <= 0) {
    return { breakdown: [], total: 0, totalCharges: 0, stripeFee: 0 };
  }

  let totalCharges = 0;
  const breakdown = [{ name: 'Base Amount', amount: base, type: 'base' }];

  platformCharges.forEach((charge) => {
    let chargeAmount = 0;
    if (charge.type === 'percentage') {
      chargeAmount = base * parseFloat(charge.value);
    } else if (charge.type === 'fixed') {
      chargeAmount = parseFloat(charge.value);
    }
    if (chargeAmount > 0) {
      breakdown.push({
        name: charge.description || charge.name,
        amount: chargeAmount,
        type: charge.type,
      });
      totalCharges += chargeAmount;
    }
  });

  // Calculate Stripe processing fee on the subtotal
  let stripeFee = 0;
  if (includeStripeFee) {
    const subtotal = base + totalCharges;
    stripeFee = (subtotal * STRIPE_PERCENTAGE_FEE) + STRIPE_FIXED_FEE;
    breakdown.push({
      name: 'Card Processing Fee (2.9% + 30p)',
      amount: stripeFee,
      type: 'stripe_fee',
    });
    totalCharges += stripeFee;
  }

  return { breakdown, total: base + totalCharges, totalCharges, stripeFee };
}

export function calculateStripeFee(amount) {
  const base = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(base) || base <= 0) return 0;
  return (base * STRIPE_PERCENTAGE_FEE) + STRIPE_FIXED_FEE;
}

export function formatCurrency(amount) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '£0.00';
  return `£${value.toFixed(2)}`;
}
