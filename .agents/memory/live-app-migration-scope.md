---
name: Live-app migration scope
description: Why a large working app should be ported with its existing API calls intact before modernizing contracts.
---

When moving an existing live app into a multi-artifact workspace, preserve the established backend routes and frontend fetch layer rather than rewriting them into generated OpenAPI hooks at the same time.

**Why:** The existing product has a large, feature-rich route surface and custom authentication, payments, uploads, and realtime behaviors. Combining an API rewrite with a structural move raises the risk of breaking live user flows and makes regressions harder to isolate.

**How to apply:** First establish visual and behavioral parity in the new structure. If a later request calls for API modernization, scope it separately with route-by-route tests. Preserve the original data store; do not migrate it to a new database merely because the workspace scaffold offers one.