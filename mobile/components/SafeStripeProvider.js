import React from 'react';

let StripeProviderComponent = null;
let stripeAvailable = false;

try {
  const stripeModule = require('@stripe/stripe-react-native');
  if (stripeModule && stripeModule.StripeProvider) {
    StripeProviderComponent = stripeModule.StripeProvider;
    stripeAvailable = true;
  }
} catch (e) {
  console.log('Stripe native module not available:', e.message);
}

export function SafeStripeProvider({ children, publishableKey, merchantIdentifier, urlScheme }) {
  if (!stripeAvailable || !StripeProviderComponent) {
    return <>{children}</>;
  }

  return (
    <StripeProviderComponent
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
      urlScheme={urlScheme}
    >
      {children}
    </StripeProviderComponent>
  );
}

export const isStripeAvailable = stripeAvailable;
