---
name: Expo tunnel process lifecycle
description: Workflow restarts may leave old Expo CLI descendants active.
---

An Expo tunnel workflow stop or restart may leave old Metro, ngrok, or worker processes active in a separate process group. Do not infer that a new workflow's "running" state means it is the only Expo server.

**Why:** An old Node runtime's Expo process survived a workflow stop while a new runtime's workflow also reported a ready tunnel. Repeated restarts without checking processes previously caused misleading port and connection symptoms.

**How to apply:** Inspect process groups and listening ports after an Expo restart when the tunnel behaves unexpectedly. Terminate only the stale Expo process group; leave the current workflow and the main backend alone. Re-check the tunnel URL, since it can change when the CLI account context changes.

Expo CLI can also turn an ngrok connection failure into a misleading `Cannot read properties of undefined (reading 'body')` error. After confirming no stale tunnel process and trying a different subdomain, do not treat another identical failure as a JavaScript bundle error or claim the phone link is live.