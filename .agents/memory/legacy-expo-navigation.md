---
name: Legacy Expo navigation
description: Compatibility decision when registering an existing React Navigation mobile app under an Expo 57 artifact.
---

Treat the starter Expo Router and a legacy app's direct React Navigation setup as mutually exclusive integration approaches.

**Why:** With this SDK, merely having Expo Router present can trigger a bundler error on direct React Navigation imports, even when the application never imports Router. This is a tooling constraint, not a missing screen or ordinary JavaScript import error.

**How to apply:** When importing an established navigation tree, choose one runtime deliberately and verify both the interactive preview and production bundle entry. Do not assume changing only the package entry removes the Router compatibility check.