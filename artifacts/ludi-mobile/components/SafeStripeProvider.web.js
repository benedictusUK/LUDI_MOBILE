// The native Stripe SDK has no React Native Web implementation.
// iOS and Android continue to use SafeStripeProvider.js.
export function SafeStripeProvider({ children }) {
  return children;
}

export const isStripeAvailable = false;