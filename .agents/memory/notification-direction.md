---
name: Notification direction
description: User's preferred push delivery provider and intended platform administration role for LUDI.
---

Use an APNs key for direct Apple push delivery rather than Expo's push service. Notifications should have templates and defined triggers.

**Why:** The user requested APNs rather than Expo push and wants to define notification templates and triggers.

**How to apply:** Retaining Expo's on-device notification library is compatible with this direction; distinguish that library from Expo's hosted push delivery service.

The platform-level SuperAdmin manages notifications and participant-fee configuration; team organisers are not platform administrators.

**Why:** The user initially chose “Notifications + SuperAdmin (recommended)” and subsequently explicitly requested SuperAdmin controls for platform and processing charges.

**How to apply:** Keep platform administration distinct from team organiser permissions. Adding controls is not permission to change existing events' agreed fees.

Notification types are choices for creating configurations, not a limit of one notification per type. Support multiple “Before an event” reminders with independent timings and templates.

**Why:** The user explicitly wants to create multiple reminders of the same type.

**How to apply:** Notification settings opens the configured-notification list with creation available. Keep Templates at the top as a separate screen for viewing and creating reusable templates.