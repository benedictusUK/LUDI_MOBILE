---
name: Payment readiness
description: The user's requirement for LUDI's newer Stripe payment fields and frontend alignment.
---

The seven newer event payment fields were added to make the Stripe integration robust and secure. The frontend needs to align with those fields, not merely have them present in the database.

**Why:** The user explicitly stated this requirement when asking for confirmation before republishing.

**How to apply:** Treat database readiness and end-to-end payment readiness as separate checks. Verify frontend inputs and displays, API validation, and server-side payment enforcement before confirming that the expanded integration is ready.

LUDI must support all three paid-event modes: fixed immediate, fixed threshold, and flexible post-event.

**Why:** The user selected “All three paid modes” rather than a subset when the audit found database fields without application behavior.

**How to apply:** Preserve coverage of all three across the web app, mobile app, and backend when changing payment behavior.

Isolated Stripe fixture success does not establish that existing payment identities match the intended publishing environment.

**Why:** Fresh Connect-backed sandbox tests succeeded, but Stripe could not retrieve historical production customer and payment-intent references using the selected LUDI sandbox credentials.

**How to apply:** Verify existing references against the intended Stripe account and mode before changing payment credentials or declaring publishing readiness. A missing-resource response can mean a different account or mode, not deletion. Do not automatically clear historical identities or payment records; reconcile their origin and get approval for any repair.