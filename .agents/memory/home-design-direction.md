---
name: Home design direction
description: User-selected home-screen direction and Next Up information requirements.
---

Use Match night's direction as the home-screen base, with the floating navigation from Clean sport. The user said it was close between those two directions and wants to utilise the newer Apple Glass UI for the navigation on iOS.

**Why:** The user selected Match night and explicitly requested Clean sport's navigation.

**How to apply:** Preserve these choices during further refinement. A browser glass approximation is not proof that native Apple Liquid Glass has been implemented.

Next Up should give date and time more prominence and structure. It should be a swipeable stack of up to three upcoming events, whether the user has voted or not, followed by a View all events card reached on the third swipe when three events are present.

Each event card should show voting status. Where payment is required, also show payment status and how much has been paid.

**Why:** The user explicitly requested these information and interaction requirements.

**How to apply:** Keep the events chronological, do not remove them simply because a vote exists, and keep amount paid distinct from amount due.

The user approved the refined Match night preview and asked to begin implementing it in the native app. Keep the original canvas alternatives for comparison.

**Why:** The user said “That looks amazing. Please can we start to implement these UI changes?”

**How to apply:** Use the approved preview as the visual reference for the native home and floating navigation. Do not treat earlier prototype-only scope as a continuing ban on application changes; do not expand this approval into redesigning unrelated screens.

Floating navigation must reserve its measured space; allow vertical scrolling for longer cards and larger text rather than shrinking touch targets to force the whole prototype into one viewport.

**Why:** Native/web font metrics and safe areas made the approved mockup taller in the application, and an overlay intercepted event-details and carousel taps.

**How to apply:** Preserve readable payment information, 44-point controls, and safe navigation spacing when refining this layout. Browser tests prove the web fallback, not native iOS glass.
