---
name: Apple Sign-In environments
description: Native-module availability and Apple token audiences differ between Expo Go, local builds, and Expo Launch.
---

Apple Sign-In in Expo Go depends on the Expo Go iOS binary, not just the JavaScript package. An early SDK 57 Expo Go build omitted the native Apple module. In SDK 57 the iOS native module's `isAvailableAsync()` returns true whenever it is linked; a false result on a supported physical iPhone therefore strongly indicates an absent module (unless the check threw an error), not an old iOS version or necessarily an outdated App Store installation.

Expo Go obtains Apple identity tokens for its shared `host.exp.Exponent` bundle identifier, while standalone builds use their own bundle identifier. Accept Expo Go's audience only for development; published authentication must verify Apple-signed tokens against the standalone app's audience.

**Why:** Expo's iOS autolinking regression dropped the module from an early Expo Go binary, and its shared identifier changes both the token audience and potentially the Apple user identifier. A JavaScript-only package update cannot change either property of an installed native client. Expo Go App Store SDK support changes over time, so old release notes are not reliable evidence of the user's current installation.

**How to apply:** Check device availability before rendering the native button, but don't diagnose a false value as an outdated app without the exact Expo Go build and iOS version. Check logs to rule out a thrown availability error. If a current physical iPhone still lacks the module, use a development build with Apple Sign-In enabled rather than bypassing the check. For backend sign-in, verify the token signature, issuer, expiration, and environment-appropriate audience; don't assume Expo Go and standalone accounts have identical Apple subjects.

For pre-TestFlight Apple Sign-In validation, prefer a standalone internally distributed iOS build over an Expo development-client build when live reload is not required.

**Why:** Internal standalone builds include the app's own Apple Sign-In entitlement and bundle identifier while running bundled JavaScript, so they test the native sign-in flow closer to TestFlight without adding a development-launcher dependency.

**How to apply:** Use internal/ad hoc signing for physical-device testing and separate store signing for TestFlight; an internal-distribution binary cannot be uploaded to TestFlight. Both require the correct native capabilities and a reachable backend. Neither configuration guarantees success without an actual signed build and device sign-in.

## Expo Launch signing identity

Do not assume the static Expo bundle identifier is the identifier used by the managed App Store build. Validate the server's Apple audience allowlist against the App ID in Expo Launch's signing logs as well as any intentional local-build identity.

**Why:** LUDI's managed archive used a different App ID from its static Expo configuration. Face ID succeeded on the signed phone app, but the live server rejected the resulting token with `jwt audience invalid` because it trusted only the local-build identifier.

**How to apply:** Keep an explicit allowlist of LUDI's verified native App IDs, retain Apple signature/issuer/expiration checks, and keep Expo Go's shared audience development-only. When only server-side audience configuration changes, republish the hosted backend; the already installed iOS app does not need another binary build.