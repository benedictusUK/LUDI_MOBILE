export function calculateTotalAmount(baseAmount, platformCharges = []) {
  const base = typeof baseAmount === 'string' ? parseFloat(baseAmount) : baseAmount;
  if (isNaN(base) || base <= 0) {
    return { breakdown: [], total: 0, totalCharges: 0 };
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

  return { breakdown, total: base + totalCharges, totalCharges };
}
