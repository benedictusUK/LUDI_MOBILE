---
name: Production SQL console
description: Transaction handling and dry-run safety for manually executed production SQL.
---

The production SQL console manages transactions itself and rejects explicit top-level transaction commands. Do not assume a script designed for a PostgreSQL command-line client runs unchanged in that console.

**Why:** The user's console rejected the initial manual reset script with a message explaining that selected statements are automatically wrapped in a transaction. Official documentation confirmed automatic transaction handling.

**How to apply:** Keep destructive manual resets atomic and safe by default. Removing a top-level ROLLBACK alone would turn a dry run into permanent deletion. A single DO statement can keep the reset atomic and intentionally raise an exception after verification to roll back a dry run. Clearly explain the intentional error and require an explicit change before applying the reset. This does not permit agent writes to managed production or bypass the supported Publish flow for schema changes.