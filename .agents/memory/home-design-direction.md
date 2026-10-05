---
name: Home design direction
description: Approved native visual direction, Next Up information requirements and optional picture policies.
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

**How to apply:** Use the approved preview as the visual reference for the native home and floating navigation. Do not treat earlier prototype-only scope as a continuing ban on application changes.

The user subsequently approved carrying the same colours, typography, cards and buttons across the remaining native screens while preserving their existing behaviour.

**Why:** The user answered “Yes please!” to this explicit scope extension after learning that only the home and shared navigation had been aligned.

**How to apply:** Align the native app consistently, including detail screens, forms, voting and payment UI. This approval does not authorise backend changes, changes to auth/payment behaviour, or a redesign of the separate web app.

Floating navigation must reserve its measured space; allow vertical scrolling for longer cards and larger text rather than shrinking touch targets to force the whole prototype into one viewport.

**Why:** Native/web font metrics and safe areas made the approved mockup taller in the application, and an overlay intercepted event-details and carousel taps.

**How to apply:** Preserve readable payment information, 44-point controls, and safe navigation spacing when refining this layout. Browser tests prove the web fallback, not native iOS glass.

Team pictures must be optional, not mandatory. Show them in the top-right of Teams cards and in place of the avatar icon in the home's Your teams section.

**Why:** The user explicitly requested these locations and said the picture should be optional.

**How to apply:** Preserve an icon fallback and allow teams to be created and used without uploading a picture.

Personal profile pictures are optional and should be used where the app represents an individual.

**Why:** The user asked to offer users the ability to upload a picture of themselves “to be used in appropriate places in the app”.

**How to apply:** Keep onboarding possible without a photo and preserve a person-icon fallback when no usable image exists.

User-chosen profile photos, including explicit removal, take precedence over later sign-in provider images.

**Why:** Provider sign-ins previously refreshed the stored image; leaving that behaviour unchanged would undo a user's upload or removal at their next sign-in.

**How to apply:** Use provider photos as a new-account default, not an overwrite of an existing account's photo choice, including account-linking paths.
