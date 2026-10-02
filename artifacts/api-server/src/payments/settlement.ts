export function allocateEvenlyMinor(
  totalMinor: number,
  paymentIds: string[],
): Map<string, number> {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new Error("Settlement total must be a non-negative integer");
  }
  if (paymentIds.length === 0) {
    throw new Error("At least one payment is required for settlement");
  }
  if (new Set(paymentIds).size !== paymentIds.length) {
    throw new Error("Payment IDs must be unique");
  }

  const orderedIds = [...paymentIds].sort();
  const base = Math.floor(totalMinor / orderedIds.length);
  const remainder = totalMinor % orderedIds.length;
  return new Map(
    orderedIds.map((id, index) => [id, base + (index < remainder ? 1 : 0)]),
  );
}

export function needsLegacyTransfer(
  transferData: unknown,
  paymentIntentStatus: string,
): boolean {
  return !transferData && paymentIntentStatus === "succeeded";
}
