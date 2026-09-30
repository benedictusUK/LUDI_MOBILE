# App Store and TestFlight publishing on Replit

Replit's **Start publishing to the App Store** button uses the guided Launch
wizard in the Project Editor. It does **not** use `eas-cli` from the Replit
shell. `mobile/eas.json` is an Expo build profile for external EAS use, not
the way to start Replit's publishing wizard.

## Project prerequisite

The existing Expo app currently lives in `mobile/` and runs through the
`Expo Mobile` workflow. It is **not registered as a mobile artifact** in this
legacy web project. A folder and workflow alone do not provide a mobile
artifact for Replit's App Store publishing flow. Moving the existing web
and mobile apps into a supported multi-artifact project structure is a
separate migration; do not start it without confirming its scope and
checking that both apps still run afterward.

## Once the mobile app is registered

1. Ensure the web backend is published and publicly reachable over HTTPS.
   The App Store build must call that stable backend, not `localhost` or a
   temporary Replit development address. Configure the mobile build's
   `EXPO_PUBLIC_API_URL` accordingly before building.
2. In the Project Editor on replit.com, open **Publishing** and select
   **Start publishing to the App Store**. Choose or link the Expo project,
   connect the Apple Developer Program account, select the Apple app, and
   complete signing in the Launch wizard.
3. Verify the intended bundle identifier is `com.ludi.mobile` and owned by
   that Apple team before the first build. The bundle ID becomes permanent
   for this Replit project's App Store publishing flow after first publish.
   `ios.usesAppleSignIn` and the `expo-apple-authentication` plugin must
   remain enabled in `app.config.js`.
4. Launch the build to App Store Connect, then install it with TestFlight.
   Check Apple Sign-In on an iPhone both the first time and on repeat
   sign-in, when Apple may omit name and email. Do not submit for App Review
   until the actual signed TestFlight build works.

A paid Apple Developer Program membership is required. The local Expo
configuration and JavaScript export can be checked before this process,
but neither proves a signed TestFlight build or a real Apple sign-in works.