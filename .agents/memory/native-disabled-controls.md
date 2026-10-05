---
name: Native disabled controls
description: Preserve actual disabled semantics in shared native controls and Expo web previews.
---

When disabling a React Native Pressable, set its `disabled` prop as well as its accessibility state; preventing the press handler alone is not sufficient.

**Why:** The browser verification of a stale fee form treated a visually disabled save button as enabled even though its handler correctly refused to save. Disabled semantics must agree with the actual behaviour for assistive technology and browser checks.

**How to apply:** Apply this consistently to native buttons and selection controls. Keep handler-side validation too, especially for revision conflicts and permission-sensitive mutations.
