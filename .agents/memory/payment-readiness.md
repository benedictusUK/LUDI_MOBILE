---
name: Payment readiness
description: The user's requirement for LUDI's newer Stripe payment fields and frontend alignment.
---

The seven newer event payment fields were added to make the Stripe integration robust and secure. The frontend needs to align with those fields, not merely have them present in the database.

**Why:** The user explicitly stated this requirement when asking for confirmation before republishing.

**How to apply:** Treat database readiness and end-to-end payment readiness as separate checks. Verify frontend inputs and displays, API validation, and server-side payment enforcement before confirming that the expanded integration is ready.