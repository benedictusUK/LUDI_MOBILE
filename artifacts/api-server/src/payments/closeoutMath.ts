import { createHash } from "node:crypto";
import { allocateEvenlyMinor } from "./settlement";

export const usesClosePayout = (event: { paymentRequired?: boolean | null; feeConfiguration?: { payoutFlow?: string } | null }) =>
  event.paymentRequired !== false && event.paymentRequired !== null && event.feeConfiguration?.payoutFlow === "on_close";

export function closeoutAmounts(venueCostMinor: number, players: {userId: string; method: string; cashAmountMinor: number}[],
  organiserId: string, onlineCollectedMinor: number) {
  if (!Number.isSafeInteger(venueCostMinor) || venueCostMinor < 0 || venueCostMinor > 99999999) throw new Error("Invalid venue cost");
  const shares = players.length ? allocateEvenlyMinor(venueCostMinor, players.map(p => p.userId)) : new Map<string, number>();
  const organiserShareMinor = shares.get(organiserId) || 0;
  let cashReceivedMinor = 0;
  for (const player of players) {
    if (player.userId === organiserId || player.method !== "cash") continue;
    if (!Number.isSafeInteger(player.cashAmountMinor) || player.cashAmountMinor < 0 || player.cashAmountMinor > (shares.get(player.userId) || 0)) {
      throw new Error("Cash received cannot exceed that player's venue share");
    }
    cashReceivedMinor += player.cashAmountMinor;
  }
  const expectedVenuePayoutMinor = Math.max(0, venueCostMinor - organiserShareMinor);
  const expectedOnlinePayoutMinor = Math.max(0, expectedVenuePayoutMinor - cashReceivedMinor);
  const payoutMinor = Math.min(expectedOnlinePayoutMinor, Math.max(0, onlineCollectedMinor));
  return { shares, organiserShareMinor, cashReceivedMinor, expectedVenuePayoutMinor, expectedOnlinePayoutMinor,
    payoutMinor, shortfallMinor: expectedOnlinePayoutMinor - payoutMinor };
}
export function closeoutRevision(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
