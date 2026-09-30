---
name: Apple Sign-In in Expo Go
description: Native-module availability and token audience differ between Expo Go and standalone iOS builds.
---

Apple Sign-In in Expo Go depends on the Expo Go iOS binary, not just the JavaScript package. An early SDK 57 Expo Go build omitted the native Apple module. `isAvailableAsync()` also returns false if the native module is absent, so false alone does not prove the iOS device is unsupported or that the installed Expo Go is outdated.

Expo Go obtains Apple identity tokens for its shared `host.exp.Exponent` bundle identifier, while standalone builds use their own bundle identifier. Accept Expo Go's audience only for development; published authentication must verify Apple-signed tokens against the standalone app's audience.

**Why:** Expo's iOS autolinking regression dropped the module from an early Expo Go binary, and its shared identifier changes both the token audience and potentially the Apple user identifier. A JavaScript-only package update cannot change either property of an installed native client. Expo Go App Store SDK support changes over time, so old release notes are not reliable evidence of the user's current installation.

**How to apply:** Check device availability before rendering the native button, but don't diagnose a false value as an outdated app without the exact Expo Go build and iOS version. If a current physical iPhone still lacks the module, use a development build with Apple Sign-In enabled rather than bypassing the check. For backend sign-in, verify the token signature, issuer, expiration, and environment-appropriate audience; don't assume Expo Go and standalone accounts have identical Apple subjects.