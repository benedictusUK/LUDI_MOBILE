---
name: Expo Go iOS sign-in
description: Expo Go SDK 57 device access requires matching Expo account sessions.
---

For current iOS Expo Go, both the Expo CLI that starts the project and the Expo Go app on the phone must be signed in to the same Expo account.

**Why:** Expo announced this requirement in September 2026. A live tunnel, successful manifest, and successful bundle do not guarantee an iPhone can open the project if either session is missing or mismatched.

**How to apply:** When diagnosing an iOS Expo Go loading problem, verify CLI login with `expo whoami`, ask the user to update Expo Go and sign in there with that same account, then use the current QR code/tunnel address rather than an older saved link. Never request their credentials.