---
name: Recurring event buffer
description: User's required initial limit and expiry-only replacement policy.
---

Recurring series should create only five events initially, with one new event generated only when one expires.

**Why:** The user explicitly specified this behavior when reporting recurring events with identical dates.

**How to apply:** Preserve this policy across creation, background maintenance and manual maintenance. Do not replace it with a number-of-weeks look-ahead policy.
