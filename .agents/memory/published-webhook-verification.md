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

A PEM parse failure does not establish that the original credential is invalid. Check its stored representation, including flattened line breaks, before asking the user to replace it.

**Why:** A valid APNs private key arrived with no newline after its PEM header. Repeated submissions were incorrectly treated as bad key material. Reconstructing standard PEM whitespace made the existing key parse as P-256; no replacement key was necessary.

**How to apply:** Validate through the freshly started application, not only a shell. Normalize intact PEM whitespace consistently for validation and signing while retaining cryptographic type/curve checks. Do not claim Apple accepted the credentials until an actual provider request succeeds. Never print the credential or the full configuration object, and collect any replacement only through the secure Secrets flow.

App Storage's `alreadySetUp` result and saved storage configuration are not upload-permission proof.

**Why:** The managed setup reported success and existing configuration, while signed-upload requests from both a shell and the freshly started API returned HTTP 401.

**How to apply:** Verify a real upload through the app's runtime before declaring pictures ready. Do not blindly replace storage or migrate existing files; investigate permissions and project ownership first.