---
name: Production account isolation
description: LUDI accounts can exist only in production; distinguish preview provisioning and managed Publish schema changes.
---

An existing LUDI account can be present in the published database and absent from the workspace database. A failed workspace SuperAdmin lookup does not establish that the account does not exist.

**Why:** An intended SuperAdmin account matched exactly once in the production read replica but had no match in the workspace. Production also did not yet contain the new role table.

**How to apply:** Check the named account with a parameterized, read-only production query before asking the user to register again. Do not create a duplicate preview profile or grant another account. Workspace operator commands target the workspace database, not automatically production.

LUDI's published database is Replit-managed. Apply its schema changes through Publish; do not put schema migrations in the published API startup command. Preserve production data rather than overwriting it with development data.

**Why:** Production was verified through Replit's production replica; the managed Publish flow owns schema migration.

**How to apply:** Separate development migration tooling from production startup. After publishing, verify required PostgreSQL functions/triggers as well as tables, and use the production console for authorized data provisioning when agent production access is read-only.

Do not assume that data inserted by development migration scripts exists in the managed production database after an incremental schema publish.

**Why:** Production had notification tables and a user-created template but no seeded notification configuration rows. Displaying catalog entries without complete settings led to invalid requests, and update-only saves then failed because the rows did not exist.

**How to apply:** Admin configuration screens must handle absent seed rows with complete, disabled defaults and persist new configuration only on an explicit authorized save. Preserve existing settings; never silently turn on notifications while initializing data.