---
name: Notification schema parity
description: Managed schema parity does not prove custom PostgreSQL notification hooks exist in production.
---

Do not treat a clean development-to-production schema diff as proof that custom SQL notification functions and triggers are installed.

**Why:** Production had neither notification outbox nor payment-notice hooks while the publishing schema check reported no differences. A republish alone was not a supported repair for that discrepancy.

**How to apply:** Inspect actual hook metadata and verify queue processing, not just table/schema parity. Keep application-level compatibility queueing idempotent and transactionally claimed. Do not add startup DDL or a custom production migration script to repair missing hooks.
