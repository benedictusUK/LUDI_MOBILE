---
name: Notification direction
description: User's preferred push delivery provider and intended platform administration role for LUDI.
---

Use an APNs key for direct Apple push delivery rather than Expo's push service. Notifications should have templates and defined triggers.

**Why:** The user requested APNs rather than Expo push and wants to define notification templates and triggers.

**How to apply:** Retaining Expo's on-device notification library is compatible with this direction; distinguish that library from Expo's hosted push delivery service.

The user chose “Notifications + SuperAdmin (recommended)” for the initial scope: notification management is included; platform-fee percentage controls are deferred.

**Why:** The user explicitly chose this initial scope after discussing the platform-level role and eventual fee controls.

**How to apply:** Keep this distinct from team organiser permissions. Future fee controls need their own request; the eventual fee controls are not permission to change current fees.