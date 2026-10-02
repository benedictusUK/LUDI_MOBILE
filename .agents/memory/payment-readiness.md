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