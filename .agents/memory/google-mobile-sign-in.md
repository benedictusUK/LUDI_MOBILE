---
name: Google mobile sign-in approach
description: Why LUDI keeps Google identity verification on its existing backend rather than introducing a parallel mobile authentication system.
---

Use the existing server-side Google provider identity and account handling for mobile Google sign-in. Keep the confidential Google OAuth client secret on the backend, and return a short-lived PKCE-bound handoff to the app rather than a long-lived app token in a deep link.

**Why:** LUDI already has provider-specific account identities and its own mobile session tokens. Adding a separate authentication system or native provider subject mapping would risk splitting accounts and bypassing its existing user/session handling. The previous mobile Google UI was only a placeholder; the old token routes trusted client-supplied identity or lacked flow binding and must not be reused.

**How to apply:** Verify identity in the browser OAuth callback, bind its return to a strictly allowed app URI and local PKCE verifier, and exchange the handoff for the normal mobile session. Configure a matching Google Web application client secret and register the exact HTTPS callback in Google Cloud before claiming live Google sign-in works. Keep the trusted production callback origin configurable and obtain the published URL from deployment metadata, not development domains.

Check actual provider readiness before requesting missing credentials solely from the managed settings inventory.

**Why:** The managed inventory reported no Google secret, but the restarted API detected credentials and the published Google entry route already redirected to Google. The real remaining blocker was Google's `redirect_uri_mismatch` response for the new mobile callback.

**How to apply:** Use non-sensitive readiness flags and authorization-entry responses to confirm configured providers without reading credential values. Ask for account-side callback registration when that is the observed failure; do not request a duplicate secret unnecessarily.