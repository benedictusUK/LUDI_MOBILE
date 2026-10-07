---
name: Native APNs token event feedback
description: Avoid recursive device registrations caused by requesting a token from its own native listener.
---

Use the token supplied by a native push-token listener; do not request another token from that listener.

**Why:** The iOS token request emits a token event even when the token is unchanged. Requesting again from the event callback caused a sustained stream of successful server registrations and a flickering registration status. The user confirmed that the updated build resolved the behaviour.

**How to apply:** Coalesce overlapping registration work while retaining genuine token rotations received during a pending request. Preserve the last confirmed registration status during routine refresh; clear it for account changes, explicit opt-out, or confirmed permission loss.
