---
name: Notification direction
description: User's preferred push delivery provider and intended platform administration role for LUDI.
---

Use an APNs key for direct Apple push delivery rather than Expo's push service. Notifications should have templates and defined triggers.

**Why:** The user requested APNs rather than Expo push and wants to define notification templates and triggers.

**How to apply:** Retaining Expo's on-device notification library is compatible with this direction; distinguish that library from Expo's hosted push delivery service.

The user wants a platform-level SuperAdmin profile to manage notifications and eventually the platform fee percentage, but is open to deferring that administration work.

**Why:** The user explicitly described this intended administration role and allowed it to be saved for later if the initial scope is too large.

**How to apply:** Keep this distinct from team organiser permissions. Confirm the initial administration scope before implementing it; the eventual fee controls are not permission to change current fees.