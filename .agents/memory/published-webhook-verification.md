---
name: Published webhook verification
description: Saved secret existence and successful Stripe API operations do not prove the published webhook can authenticate events.
---

Verify the running published webhook with real Stripe deliveries; do not infer readiness from saved secret existence or an enabled endpoint.

**Why:** LUDI's secret-existence check reported the production webhook key present, while actual signed sandbox deliveries reached the published API and were rejected as incompletely configured. The running deployment did not have a usable signing secret, despite successful payment API tests.

**How to apply:** Compare current deployment logs with the handler's failure branch. An incomplete-configuration warning with a signature present means the runtime signing secret is missing or empty, not a failed signature comparison. Check the existing key's inclusion in production publishing settings and validate delivery again after republishing. Do not ask for replacement credentials merely because a saved key is absent from the running deployment.

Review publishing readiness before recommending a secret-refresh republish when the workspace also contains unverified production code or schema changes.

**Why:** Republishing deploys the current workspace, not just the saved secret. Successful development payment checks do not authorize production schema changes.

**How to apply:** Keep readiness inspection read-only and leave publishing and production database changes subject to the user's approval.