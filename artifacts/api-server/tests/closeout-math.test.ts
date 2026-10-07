import test from "node:test";
import assert from "node:assert/strict";
import { closeoutAmounts, closeoutRevision, usesClosePayout } from "../src/payments/closeoutMath";
import { calculatePlayerPrice } from "@workspace/db";

const online = (userId: string) => ({ userId, method: "online", cashAmountMinor: 0 });
test("organiser's own playing share and cash are deducted only from expected venue payout", () => {
  const quote = closeoutAmounts(3000, [online("organiser"), online("a"), { userId: "b", method: "cash", cashAmountMinor: 1000 }], "organiser", 1000);
  assert.equal(quote.organiserShareMinor, 1000);
  assert.equal(quote.expectedVenuePayoutMinor, 2000);
  assert.equal(quote.expectedOnlinePayoutMinor, 1000);
  assert.equal(quote.payoutMinor, 1000); // Cash must not be subtracted a second time.
  assert.equal(quote.shortfallMinor, 0);
});
test("a non-playing organiser receives no own-share deduction", () => {
  assert.equal(closeoutAmounts(3000, [online("a"), online("b"), online("c")], "organiser", 3000).payoutMinor, 3000);
});
test("partial cash and an unpaid final player produce monetary shortfalls, not a player-count veto", () => {
  const quote = closeoutAmounts(3000, [online("organiser"), online("a"), { userId: "b", method: "cash", cashAmountMinor: 600 }], "organiser", 700);
  assert.equal(quote.expectedOnlinePayoutMinor, 1400);
  assert.equal(quote.payoutMinor, 700);
  assert.equal(quote.shortfallMinor, 700);
});
test("overcollection never increases organiser payout above venue less own share and cash", () => {
  const quote = closeoutAmounts(3000, [online("organiser"), online("a"), online("b")], "organiser", 5000);
  assert.equal(quote.payoutMinor, 2000);
});
test("penny allocation is deterministic and never exceeds the venue cost", () => {
  const quote = closeoutAmounts(1001, [online("c"), online("a"), online("b")], "a", 2000);
  assert.equal([...quote.shares.values()].reduce((a, b) => a + b, 0), 1001);
  assert.equal(quote.organiserShareMinor, 334);
  assert.equal(quote.payoutMinor, 667);
});
test("invalid venue and cash values fail explicitly", () => {
  for (const value of [-1, 1.5, Number.NaN, 100000000]) assert.throws(() => closeoutAmounts(value, [online("a")], "o", 1));
  assert.throws(() => closeoutAmounts(1000, [{ userId: "a", method: "cash", cashAmountMinor: 1001 }], "o", 0));
});
test("upfront fees stay based on the original maximum; a late link prices its final share", () => {
  const fees = { platformBasisPoints: 500, stripeBasisPoints: 299, stripeFixedMinor: 0, revision: 1 };
  const upfront = calculatePlayerPrice(1200, fees);
  const late = calculatePlayerPrice(1000, fees);
  assert.equal(upfront.totalAmountMinor, 1298);
  assert.equal(upfront.totalAmountMinor - 200, 1098); // Refund venue only, keep £0.98 original fees.
  assert.equal(upfront.totalAmountMinor - 1200, 98); // Cash refund never includes fees.
  assert.equal(late.totalAmountMinor, 1082);
});
test("old snapshots retain their routing and quote changes invalidate confirmation", () => {
  assert.equal(usesClosePayout({ feeConfiguration: {} }), false);
  assert.equal(usesClosePayout({ feeConfiguration: { payoutFlow: "on_close" } }), true);
  assert.equal(usesClosePayout({ paymentRequired: false, feeConfiguration: { payoutFlow: "on_close" } }), false);
  assert.notEqual(closeoutRevision({ payout: 1000 }), closeoutRevision({ payout: 900 }));
});
