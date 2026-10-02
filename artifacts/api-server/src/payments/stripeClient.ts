import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

const configuredFeeBasisPoints = Number(
  process.env.LUDI_PLATFORM_FEE_BASIS_POINTS ?? "500",
);
if (
  !Number.isInteger(configuredFeeBasisPoints) ||
  configuredFeeBasisPoints < 0 ||
  configuredFeeBasisPoints > 10_000
) {
  throw new Error(
    "LUDI_PLATFORM_FEE_BASIS_POINTS must be an integer between 0 and 10000",
  );
}

export const platformFeeBasisPoints = configuredFeeBasisPoints;

// Preserve the verified API contract. Stripe's SDK types accept only its latest
// version, so this assertion deliberately retains our older pinned version.
export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-07-30.basil" as Stripe.LatestApiVersion,
  maxNetworkRetries: 2,
});
