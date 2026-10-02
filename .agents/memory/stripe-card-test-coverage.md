---
name: Stripe card test coverage
description: Distinguish saved-card declines and real bank-authentication behavior from mocked provider responses.
---

Exercise bank-authentication-required cards against Stripe itself before treating mocked authentication tests as proof of payment readiness.

**Why:** Mocked card confirmation returned an authentication action, but real off-session confirmation instead rejected the authentication-required card and returned it to the payment-method-needed state. The frontend therefore had no action to present.

**How to apply:** Verify the provider response for interactive saved-card checkout, then independently verify completion of bank approval and return to the app. Merely receiving an authentication action is not proof that the complete browser or native flow works.

Distinguish a decline when saving a card from a decline when charging an already-saved card.

**Why:** Stripe's ordinary issuer-decline fixtures can fail at attachment, preventing the test from exercising checkout at all.

**How to apply:** Use Stripe's documented decline-after-attaching fixture for saved-card checkout checks; test card-saving rejection separately. Keep organizer destination transfers and fee reversals distinct from ordinary platform-charge smoke tests.