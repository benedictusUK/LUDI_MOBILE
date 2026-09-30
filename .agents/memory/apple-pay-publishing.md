---
name: Apple Pay publishing prerequisite
description: Why iOS card-only payments are required until Apple Developer signing is configured for Apple Pay.
---

Keep Apple Pay disabled for iOS publishing until the Apple Developer App ID used by Expo Launch has Apple Pay enabled, the intended Merchant ID is registered and associated with it, and the regenerated provisioning profile includes the in-app-payments entitlement.

**Why:** An Expo Launch App Store archive failed at code signing because its automatically generated profile did not support Apple Pay or the configured merchant identifier. A valid JavaScript export and Expo config check do not catch missing capabilities in the remote provisioning profile. Card payments do not need this entitlement.

**How to apply:** When restoring Apple Pay, first verify the account-side capability and signed profile, then restore the native merchant configuration and Apple Pay UI together. Do not restore only the payment-sheet option or only the entitlement; those partial states either fail publishing or show a payment method that cannot work.