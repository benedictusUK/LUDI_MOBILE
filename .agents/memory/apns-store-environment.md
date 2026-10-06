---
name: APNs environment on store installs
description: Why a null provisioning-profile environment is not proof that iOS push is disabled.
---

A store-installed iOS app may lack a readable embedded provisioning profile. Do not treat a null profile-derived APNs environment as proof that the signed app lacks the push entitlement.

**Why:** Expo's environment lookup reads the embedded profile rather than the live signing entitlement. LUDI rejected registration after Apple had already returned a native device token, producing a misleading capability error.

**How to apply:** Require successful native Apple token registration first. Honour an explicit development or production environment. When the profile environment is absent, use production only for an identified App Store release; fail explicitly for unknown or non-store releases. Preserve native token errors and do not claim real delivery is verified by mocked tests.
