---
name: Native startup animation
description: LUDI animation should be the returning-user loading state, not only a first-launch introduction.
---

Use the existing LUDI animation while native authentication, theme, or initial dashboard data loads, including for returning accounts. Keep dashboard failures and retry controls visible instead of hiding them behind an animation.

**Why:** The user requested replacing the generic signed-in loading screen with the LUDI animation. The previous first-launch-only reveal did not cover returning users' dashboard loading.

**How to apply:** Treat it as an actual loading state, not a saved “intro seen” flag. Ready data can show Home without waiting for a separate animation-completion callback.
