# Test Apple Sign-In on an iPhone and in TestFlight

The `internal` profile builds a standalone iPhone app for direct installation.
Unlike Expo Go, it includes the native Apple Sign-In module and uses LUDI's
`com.ludi.mobile` identifier. It also exercises the same Apple entitlement as
the `testflight` profile. It is not a developer-client build: it runs its bundled
JavaScript without a Metro server, making the sign-in test closer to TestFlight.

## Before either build

1. An Expo account and a paid Apple Developer Program membership are required
   for signing and installing an iOS build on a physical device.
2. In `mobile/`, sign in with `npx eas-cli login`, then run
   `npx eas-cli init`. This creates or links an Expo project. Because this app
   uses a dynamic `app.config.js`, EAS may ask you to add the resulting UUID
   yourself as `extra.eas.projectId` in that file; do not use the app slug in
   its place. The previous placeholder ID was removed because it cannot
   identify an EAS project.
3. In the linked Expo project's **Environment variables**, set
   `EXPO_PUBLIC_API_URL` to the HTTPS origin of the LUDI backend for both the
   **development** and **production** environments. These are EAS environments,
   separate from Replit environment variables. A TestFlight binary embeds this
   URL at build time: do not use `localhost` or a temporary development address
   for the production environment. The backend must be reachable from the
   iPhone, with `/api/auth/mobile/apple` available.
4. Make sure the Apple Developer team owns the `com.ludi.mobile` bundle
   identifier. EAS Build can enable the Sign in with Apple capability while
   configuring iOS signing. Keep `ios.usesAppleSignIn` and the
   `expo-apple-authentication` plugin in `app.config.js`.

## Test without TestFlight

From `mobile/`, register the iPhone with `npx eas-cli device:create`, then run:

```sh
npx eas-cli build --platform ios --profile internal
```

Install the resulting internal-distribution build on the registered iPhone and
try Continue with Apple. This build uses ad hoc signing and cannot be uploaded
to TestFlight. Check both a first sign-in and a repeat sign-in; Apple may omit
the name and email on repeat sign-ins.

## TestFlight

Once a stable HTTPS backend is available in the production EAS environment:

```sh
npx eas-cli build --platform ios --profile testflight
npx eas-cli submit --platform ios --latest
```

The `testflight` profile uses store distribution and a new iOS build number.
After Apple processes the upload, install it using TestFlight and check Apple
Sign-In against the backend again. App Store Connect access, signing, and
Apple's processing are required; configuring the profiles alone does not prove
a signed build or a device sign-in succeeds. Do not publish the app until the
TestFlight sign-in has actually passed.