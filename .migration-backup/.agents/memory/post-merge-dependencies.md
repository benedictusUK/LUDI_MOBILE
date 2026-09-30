---
name: Post-merge dependency installs
description: Clean installs during post-merge setup can expose unrelated vulnerable lockfile entries.
---

Post-merge setup must consider every dependency tree it reinstalls, not only the files changed by the merged task. Replit's package firewall can block a clean install on a vulnerable transitive package already present in an older lockfile, even if day-to-day development seemed healthy.

**Why:** A mobile-only merge triggered a root web dependency reinstall. The existing lockfile contained blocked packages, and attempting a normal uninstall also re-entered the blocked full install.

**How to apply:** Trace blocked packages to their direct parents, remove unused parents or update compatible ones, refresh the lockfile without downloading blocked tarballs if necessary, then verify with a real clean install. Do not bypass the firewall or force unrelated breaking upgrades merely to make setup pass.