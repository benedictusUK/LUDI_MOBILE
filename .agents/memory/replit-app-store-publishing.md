---
name: Replit App Store publishing
description: Distinguishes Replit's guided mobile publishing from a legacy Expo folder and external EAS CLI.
---

Replit's Project Editor starts TestFlight/App Store builds with its guided Publishing wizard, not by running EAS CLI in the Replit shell. A legacy Expo app stored in a subfolder and served by a workflow is not automatically a registered mobile artifact; even if the web backend is published and the App Store button appears, the guided flow may not have a mobile target.

**Why:** A published web app and working Expo Go tunnel were insufficient to launch the App Store wizard in a legacy combined project. EAS CLI build profiles prepared for this setup did not register the app with Replit's mobile publishing system.

**How to apply:** Check for a mobile artifact manifest before promising that the Replit wizard can launch. If absent, explain that a multi-artifact migration changes project structure and get informed approval before moving the working apps. Distinguish an editor-button problem from a build/signing failure, and ask where the flow stops if needed. Use Replit's guided flow for TestFlight; treat EAS CLI profiles as external Expo tooling only.