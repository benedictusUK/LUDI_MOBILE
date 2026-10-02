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

**How to apply:** For the existing Accounts v1 organizer onboarding, direct the user to the Accounts v1 support setting in the dedicated LUDI sandbox. Do not silently migrate onboarding to Accounts v2 just to run payment checks; that is a separate change. The user agreed to finish verification of the existing flow before assessing a v2 migration separately.

Stripe's official sources publish two Dashboard routes for Accounts v1 support.

**Why:** The API error and developer documentation link to /settings/developers/api-policies/feat_accounts_v1_support, while Stripe's support article links to /settings/features/feat_accounts_v1_support. A user could not locate the setting through the first route.

**How to apply:** Offer https://dashboard.stripe.com/settings/features/feat_accounts_v1_support as an alternate link. The documented manual path is Settings → Developers → API Policies → Accounts v1 Support; use the edit control to enable test-mode/sandbox support and save, without enabling live mode.

Sandbox organizer capabilities can activate asynchronously even when no fields are currently due.

**Why:** A valid UK test organizer initially had charges disabled with an empty currently-due list, then reached active card-payment and transfer capabilities after a longer wait. A short timeout falsely suggested onboarding was blocked.

**How to apply:** Inspect capability status, pending verification, and the disabled reason together. Allow a bounded verification wait before treating inactive capabilities with no missing fields as a configuration failure.