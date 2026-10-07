export interface FeeConfiguration {
  /** New events retain venue funds on the platform until deliberate closure. */
  payoutFlow?: "on_close";
  platformBasisPoints: number;
  stripeBasisPoints: number;
  stripeFixedMinor: number;
  revision: number;
}
export interface PlayerPrice {
  baseAmountMinor: number;
  platformFeeMinor: number;
  processingFeeMinor: number;
  totalAmountMinor: number;
}
export function calculatePlayerPrice(baseAmountMinor: number, fees: FeeConfiguration): PlayerPrice {
  if (!Number.isSafeInteger(baseAmountMinor) || baseAmountMinor < 0) throw new Error("Invalid base amount");
  for (const rate of [fees.platformBasisPoints, fees.stripeBasisPoints]) {
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error("Invalid fee rate");
  }
  if (!Number.isInteger(fees.stripeFixedMinor) || fees.stripeFixedMinor < 0 || fees.stripeFixedMinor > 1000000) throw new Error("Invalid fixed processing charge");
  if (baseAmountMinor === 0) return { baseAmountMinor, platformFeeMinor: 0, processingFeeMinor: 0, totalAmountMinor: 0 };
  const platformFeeMinor = Math.ceil(baseAmountMinor * fees.platformBasisPoints / 10000);
  const subtotal = baseAmountMinor + platformFeeMinor;
  const processingFeeMinor = Math.ceil(subtotal * fees.stripeBasisPoints / 10000) + fees.stripeFixedMinor;
  const totalAmountMinor = subtotal + processingFeeMinor;
  if (!Number.isSafeInteger(totalAmountMinor) || totalAmountMinor > 99999999) throw new Error("Payment exceeds the supported maximum");
  return { baseAmountMinor, platformFeeMinor, processingFeeMinor, totalAmountMinor };
}
export function residualRefundMinor(maximumBaseMinor: number, finalBaseMinor: number) {
  if (![maximumBaseMinor, finalBaseMinor].every(n => Number.isSafeInteger(n) && n >= 0) || finalBaseMinor > maximumBaseMinor) throw new Error("Final venue share exceeds the agreed maximum");
  return maximumBaseMinor - finalBaseMinor;
}