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
export interface FeeConfiguration {
  platformBasisPoints: number;
  stripeBasisPoints: number;
  stripeFixedMinor: number;
  revision?: number;
}

export function calculateTotalAmount(
  baseAmount: number | string,
  platformCharges: PlatformCharge[],
  fees?: FeeConfiguration,
): CostCalculation {
  const base = typeof baseAmount === "string" ? parseFloat(baseAmount) : baseAmount;
  if (isNaN(base) || base <= 0) return { breakdown: [], total: 0, totalCharges: 0 };

  const baseMinor = Math.round(base * 100);
  let totalChargesMinor = 0;
  const breakdown: BreakdownItem[] = [{ name: "Base Amount", amount: baseMinor / 100, type: "base" }];

  const platform = fees ? [{
    name: "Platform charge", description: "Platform charge", type: "percentage", value: String(fees.platformBasisPoints / 10000),
  }] : platformCharges.filter(c => c.isActive !== false && !c.name.startsWith("stripe_processing_"));
  platform.forEach((charge) => {
    let chargeAmount = 0;
    if (charge.type === "percentage") {
      chargeAmount = Math.ceil(baseMinor * Math.round(parseFloat(charge.value) * 10000) / 10000) / 100;
    } else if (charge.type === "fixed") {
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
  const rate = fees ? fees.stripeBasisPoints / 10000 : Number(platformCharges.find(c => c.name === "stripe_processing_percentage")?.value || 0);
  const fixedMinor = fees ? fees.stripeFixedMinor : Math.round(Number(platformCharges.find(c => c.name === "stripe_processing_fixed")?.value || 0) * 100);
  const processingMinor = Math.ceil((baseMinor + totalChargesMinor) * Math.round(rate * 10000) / 10000) + fixedMinor;
  if (processingMinor > 0) breakdown.push({ name: "Processing charge", amount: processingMinor / 100, type: "processing" });
  totalChargesMinor += processingMinor;
  return {
    breakdown,
    total: (baseMinor + totalChargesMinor) / 100,
    totalCharges: totalChargesMinor / 100,
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
