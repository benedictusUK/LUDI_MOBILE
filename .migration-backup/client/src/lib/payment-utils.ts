import type { PlatformCharge } from "@/types";

interface BreakdownItem {
  name: string;
  amount: number;
  type: string;
}

interface CostCalculation {
  breakdown: BreakdownItem[];
  total: number;
  totalCharges: number;
}

export function calculateTotalAmount(
  baseAmount: number | string,
  platformCharges: PlatformCharge[],
): CostCalculation {
  const base = typeof baseAmount === "string" ? parseFloat(baseAmount) : baseAmount;
  if (isNaN(base) || base <= 0) return { breakdown: [], total: 0, totalCharges: 0 };

  let totalCharges = 0;
  const breakdown: BreakdownItem[] = [{ name: "Base Amount", amount: base, type: "base" }];

  platformCharges.forEach((charge) => {
    let chargeAmount = 0;
    if (charge.type === "percentage") {
      chargeAmount = base * parseFloat(charge.value);
    } else if (charge.type === "fixed") {
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

  return {
    breakdown,
    total: base + totalCharges,
    totalCharges,
  };
}

export function calculatePerPersonCost(
  venueCost: string,
  attendeeCount: number,
  platformCharges: PlatformCharge[],
): number {
  const totalVenueCost = parseFloat(venueCost || "0");
  if (totalVenueCost <= 0 || attendeeCount === 0) return 0;

  const baseCostPerPerson = totalVenueCost / attendeeCount;
  const costCalculation = calculateTotalAmount(baseCostPerPerson, platformCharges);
  return costCalculation.total;
}
