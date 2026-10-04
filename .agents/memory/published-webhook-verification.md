---
name: Published credential verification
description: Saved secrets and confirmed submissions do not prove valid credentials or a correctly configured published runtime.
---

Verify the running published webhook with real Stripe deliveries; do not infer readiness from saved secret existence or an enabled endpoint.

**Why:** LUDI's secret-existence check reported the production webhook key present, while actual signed sandbox deliveries reached the published API and were rejected as incompletely configured. The running deployment did not have a usable signing secret, despite successful payment API tests.

**How to apply:** Compare current deployment logs with the handler's failure branch. An incomplete-configuration warning with a signature present means the runtime signing secret is missing or empty, not a failed signature comparison. Check the existing key's inclusion in production publishing settings and validate delivery again after republishing. Do not ask for replacement credentials merely because a saved key is absent from the running deployment.

Review publishing readiness before recommending a secret-refresh republish when the workspace also contains unverified production code or schema changes.

**Why:** Republishing deploys the current workspace, not just the saved secret. Successful development payment checks do not authorize production schema changes.

**How to apply:** Keep readiness inspection read-only and leave publishing and production database changes subject to the user's approval.

A confirmed Secrets submission does not validate the credential's contents.

**Why:** Repeated APNs private-key submissions still failed cryptographic parsing, even with both expected PEM marker lines present. Checking common formatting and encoding variants did not establish validity.

**How to apply:** Validate credentials through the application's safe configuration check before claiming readiness. If repeated submissions fail and formatting checks do not help, stop repeating the same request and ask whether the user has the untouched original credential file. Collect any replacement only through the secure Secrets flow. Never print the credential or the full configuration object.