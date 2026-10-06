---
name: Published iOS identity
description: The user-confirmed App Store Connect Bundle ID to preserve when configuring LUDI signing and APNs.
---

LUDI's existing App Store Connect Bundle ID is `app.replit.ludi`, also shown in the user's Apple Developer portal.

**Why:** The user confirmed this identity from App Store Connect. Preserve the existing published app rather than creating a different app identity.

**How to apply:** Align signing and APNs configuration with the existing published identity. Do not assume a starter bundle identifier is the published identifier; obtain explicit permission before changing bundle identifiers.
