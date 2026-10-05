---
name: Team management compatibility
description: Why installed-mobile compatibility, durable invitation state, and historical team records must be preserved.
---

Keep old installed-iPhone team endpoints working when changing the current mobile caller. Route aliases must use the same admission and permission checks, not separate legacy mutations.

**Why:** A real team invitation failed because the installed mobile app used a route that the backend did not implement. Updating only the current mobile source would leave installed builds broken.

**How to apply:** Check both canonical and older mobile URLs whenever changing team management. Use one transaction boundary for all admission and membership changes.

Keep invitation and request outcomes independent of notification delivery and read state.

**Why:** Reading a message must not remove the user's choice to accept or decline. Disabled or failed notifications must not make a valid invitation inaccessible.

**How to apply:** Provide pending invitations in Teams independently of the inbox. Resolve actions only when the underlying invitation/request is resolved, and preserve success with an explicit warning if post-commit notification delivery fails.

Membership removal or blocking must not erase attendance or financial history; teams with event history need archival rather than destructive deletion.

**Why:** The review was not permission to delete historical events, votes, or payments. Existing cascade deletion made deleting a team a risk to those records.

**How to apply:** Keep membership changes separate from event/payment records. Preserve the history-protection boundary if adding archival or changing deletion.
