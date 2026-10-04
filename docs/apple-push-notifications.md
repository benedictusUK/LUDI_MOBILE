# LUDI direct Apple push notifications

LUDI uses `expo-notifications` **on the iPhone**, but sends notifications directly
to Apple APNs from the API server. It does not obtain Expo push tokens or use the
Expo hosted push-delivery service. Existing in-app notifications remain available.

## Activate delivery

1. Configure Apple APNs credentials through Replit Secrets:
   - `APNS_PRIVATE_KEY`: the complete `.p8` ES256 key, including PEM delimiters.
   - `APNS_KEY_ID`: the Apple key identifier.
   - `APNS_TEAM_ID`: the Apple Developer team identifier.
2. The APNs topic defaults to the existing `com.ludi.mobile` bundle ID. Set the
   non-secret `APNS_BUNDLE_ID` only if the actual signed app's bundle ID changes.
3. The Apple App ID and signed provisioning profile must support Push
   Notifications. Build/install a new signed LUDI iPhone version containing the
   notification plugin. Expo Go and a browser preview cannot verify APNs delivery.
4. Sign in on a physical iPhone and enable **iPhone push notifications** in LUDI
   Settings. Only this user action requests OS permission. Registration on later
   launches checks existing permission without prompting.
5. Grant the intended existing account SuperAdmin access using trusted operator
   tooling, never a public registration form:

   ```sh
   pnpm --filter @workspace/db run superadmin grant account@example.com
   ```

   This operator command targets the current database connection (development
   when run in the workspace), not automatically the published database. Revoke
   access with the same command using `revoke`. The command must match exactly
   one existing account. It does not change team organiser permissions. An
   account may exist in production only; do not create a duplicate preview
   profile to work around this. Publish the new schema first, then provision the
   existing production account through the production SQL console.
6. On the web, open **SuperAdmin → Notifications**. Send a test to your own
   opted-in iPhone. Check the notification with LUDI backgrounded/closed and tap
   it to verify navigation. `accepted` means Apple accepted the request, not that
   a person received or read it.

The native app reads the **signed push-service environment** rather than
guessing from JavaScript development mode. Signed development devices use APNs
sandbox; distribution/TestFlight devices use production. If your Apple keys are
environment-specific, a separate sandbox key can be configured with
`APNS_SANDBOX_PRIVATE_KEY` and `APNS_SANDBOX_KEY_ID`, using the same team ID.

## Management and behavior

- Templates support `{eventName}`, `{teamName}`, `{startTime}`, `{startDate}`,
  `{location}`, `{amount}` and `{message}`. Unknown/malformed placeholders are
  rejected. Preview uses sample data and never sends a notification.
- Supported triggers: event creation/change/cancellation, eligible nearby flares,
  event reminders, payment reminders, payment requests, bank authorisation,
  confirmed collection and payment failures.
- Supported audiences are defined per trigger. Flare/payment targeting cannot
  be broadened to all users through the editor.
- Event and payment deadline reminders are initially **off**. Enabling reminders
  does not replay reminders whose due time predates that configuration change.
- Payment notifications do not collect money or change payment terms. A newly
  created intent waiting for a payment method is not labelled a card failure.
- Native push respects global and category opt-outs, including payment opt-outs.
  Important in-app payment notices remain independent of the native-push setting.
- Test sends target only the signed-in SuperAdmin's opted-in devices.
- Notification taps open the relevant event; cancellation and test notifications
  open the notification inbox. A notification for another signed-in account is
  not opened after an account switch.
- Logout disables this installation's server registration before removing local
  authentication. If connectivity prevents removal, logout still works and the
  app warns the user how to stop alerts in iPhone Settings.

## Reliability and operations

An additive PostgreSQL outbox catches existing notification writers, including
legacy bulk flare inserts. Queue claims are transactional, jobs have per-device
deduplication keys, workers recover abandoned claims, and scheduled reminders have
durable claims. Retries use backoff and expiry. A stable APNs collapse ID limits
repeat pending alerts; ambiguous network failures still cannot prove exactly-once
display on an iPhone.

Before dispatch, the worker rechecks account/device ownership, user opt-in and
trigger enablement. Reminder dispatch also checks current attendance, event start
and outstanding-payment state. Invalid Apple tokens disable their registration.
Secrets and device tokens are excluded from the SuperAdmin delivery response.

The migration runner applies development changes. Replit's managed production
schema changes belong to the Publish flow, not application startup. Preserve
existing production data when publishing; never overwrite it with development
fixtures. Do not edit already-applied migration SQL; create an additive migration
instead. Publishing remains a separate user action.

Production verification must also confirm the notification-outbox and
payment-transition database triggers exist; passing development checks alone
does not establish that these PostgreSQL functions/triggers reached production.
Scheduled reminders need an always-running API/worker. An idle autoscale
deployment does not guarantee on-time background scheduling; keep reminders
disabled until that operational requirement is met.

## Verification

```sh
pnpm run typecheck
node --test artifacts/api-server/src/notifications/notifications.test.mjs
```

The development-only `lib/db/scripts/verify-notification-admin.mjs` helper creates
temporary signed-in test sessions and supports `setup`, `check`, `payment-check`
and `cleanup`. Run cleanup after a browser pass. Never run fixtures against a
published environment or print session cookies.

Apple acceptance, lock-screen delivery and native tap behavior still require
valid Apple credentials and a signed physical iPhone. Passing server/browser
checks or compiling an iOS bundle does not substitute for that device test.