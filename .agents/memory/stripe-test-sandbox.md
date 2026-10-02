---
name: Stripe test sandbox
description: The dedicated sandbox intended for LUDI payment testing.
---

LUDI has a dedicated sandbox within the user's Stripe account for monitoring tests.

**Why:** The user created a dedicated LUDI sandbox so they can monitor their tests.

**How to apply:** Use that sandbox's credentials for LUDI testing rather than another application's sandbox. Testing on a published LUDI URL still uses the dedicated sandbox; publishing is not permission to switch Stripe to live mode.

Check Connect activation separately from API-key validity.

**Why:** The dedicated sandbox accepted balance requests and ordinary card charges while refusing connected-account creation because Connect was not activated. Valid keys alone do not establish organizer-payment readiness.

**How to apply:** When account creation reports that Connect needs activation, request activation in the existing LUDI sandbox, not replacement keys or a different Stripe account. Do not bypass organizer destinations just to make the checkout tests pass.

New Connect configurations can reject Accounts v1 creation even after Connect activation.

**Why:** Stripe's account-creation response explicitly required Accounts v2 or the Dashboard's Accounts v1 compatibility policy. This is a separate policy gate, not an invalid key or evidence that Connect is still disabled.

**How to apply:** For the existing Accounts v1 organizer onboarding, direct the user to https://dashboard.stripe.com/settings/developers/api-policies/feat_accounts_v1_support in the dedicated LUDI sandbox. Do not silently migrate onboarding to Accounts v2 just to run payment checks; that is a separate change.