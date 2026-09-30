---
name: Expo Go iOS sign-in
description: Expo Go SDK 57 device access requires matching Expo account sessions.
---

For current iOS Expo Go, both the Expo CLI that starts the project and the Expo Go app on the phone must be signed in to the same Expo account.

**Why:** Expo announced this requirement in September 2026. A live tunnel, successful manifest, and successful bundle do not guarantee an iPhone can open the project if either session is missing or mismatched.

**How to apply:** Use Replit's **Preview on your phone** managed Expo sign-in instructions. The artifact's development workflow signs the CLI in through `create-launch` when a managed session is available; never suggest manual `expo login`, EAS login, or signing into a managed private account directly. If the panel has no managed sign-in steps, explain that the managed flow is unavailable in this session. Use the current QR code, not an older saved link. Never request credentials.