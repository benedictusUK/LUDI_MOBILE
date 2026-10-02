---
name: Managed database query results
description: Development SQL mutations can succeed even when the query callback reports an output-formatting error.
---

A multi-statement development DDL call reported `Cannot read properties of undefined (reading 'length')`, but a subsequent catalog query confirmed both requested indexes had been created.

**Why:** A result-formatting failure is not proof that a mutation failed; blindly retrying can repeat a successful write.

**How to apply:** Inspect the intended effects with a read-only query before retrying ambiguous mutations. Prefer one SQL statement per callback when applying development DDL. Production queries remain read-only.