const DECIMAL_MONEY_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

/**
 * Converts a GBP-style decimal string to integer minor units without using
 * floating-point arithmetic. API callers must never be allowed to choose the
 * value passed to this function for a charge; it converts server-owned values.
 */
export function decimalToMinorUnits(value: string): number {
  const normalized = value.trim();
  const match = DECIMAL_MONEY_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(
      "Money must be a non-negative decimal with at most two fractional digits",
    );
  }

  const major = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = major * 100 + Number(fraction);

  if (!Number.isSafeInteger(minor)) {
    throw new Error("Money amount exceeds the supported range");
  }

  return minor;
}

export function calculatePercentageFeeMinor(
  amountMinor: number,
  basisPoints: number,
): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("Amount must be a non-negative integer in minor units");
  }
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 10_000
  ) {
    throw new Error("Basis points must be an integer between 0 and 10000");
  }

  return Math.round((amountMinor * basisPoints) / 10_000);
}
