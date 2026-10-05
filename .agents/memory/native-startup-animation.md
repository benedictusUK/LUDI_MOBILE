---
name: Native startup animation
description: LUDI animation should be the returning-user loading state, not only a first-launch introduction.
---

Play the supplied replacement LUDI animation through once on every app startup, including returning accounts, before showing Home or login. Load authentication, theme, fonts and initial dashboard data concurrently. If queries take longer, hold the final frame instead of looping or opening Home early. Keep failures and retry controls visible after playback.

**Why:** The user replaced the old animation because the entire branding changed, explicitly said the old animation need not be retained, and required one complete playback before Home or login to allow database queries to finish.

**How to apply:** Do not use a saved “intro seen” flag or skip playback when data loads quickly. Measure duration from the supplied asset and start the completion clock when its first frame is displayed. Home requires both completed playback and ready initial data; retry and later refreshes need not replay the introduction.
