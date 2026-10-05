---
name: App Storage runtime binding
description: Preserve the default bucket association and verify real storage access, not just provisioning status.
---

Preserve the app's default storage-bucket association when changing workspace configuration. Provisioning success and configured storage variables are not proof that the current runtime or published app can access that bucket.

**Why:** Provisioning reported an existing, ready bucket while the runtime reported no default bucket. Restoring the association made the runtime recognize the bucket, but signing still returned 401, so assignment and authorization must be verified separately.

**How to apply:** Use the schema-validated workspace configuration flow. Verify actual upload-URL signing and storage access in the environment being diagnosed before claiming a fix. Do not create a replacement bucket, migrate existing files, or rewrite the standard GCS authentication merely to bypass an authorization failure.
