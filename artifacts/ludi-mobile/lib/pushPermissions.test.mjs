import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPushPermission, readPushPreferences, pushPermissionGranted, permissionLabel } from './pushPermissions.mjs';

test('reads JSON preferences rather than spreading a Fetch Response', async () => {
  const preferences = await readPushPreferences(new Response(JSON.stringify({ pushNotificationsIOS: true }), { status: 200 }));
  assert.equal(preferences.pushNotificationsIOS, true);
  assert.equal(preferences.paymentReminders, true);
});
test('failed saves are explicit and cannot look like an opt-in', async () => {
  await assert.rejects(readPushPreferences(new Response(JSON.stringify({ message: 'Save failed' }), { status: 503 })), /Save failed/);
});
test('refresh checks permission without prompting; explicit enable asks once', async () => {
  let requests = 0;
  const notifications = {
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: true, status: 'undetermined' }),
    requestPermissionsAsync: async () => { requests++; return { granted: true }; },
  };
  assert.equal(pushPermissionGranted(await getPushPermission(notifications)), false);
  assert.equal(requests, 0);
  assert.equal(pushPermissionGranted(await getPushPermission(notifications, true)), true);
  assert.equal(requests, 1);
});
test('denied permission that cannot prompt directs to Settings instead', async () => {
  const permission = await getPushPermission({
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: false, status: 'denied' }),
    requestPermissionsAsync: async () => { throw new Error('Must not ask again'); },
  }, true);
  assert.equal(pushPermissionGranted(permission), false);
  assert.equal(permissionLabel(permission), 'Denied in iPhone Settings');
});
test('authorized and provisional iOS statuses register, denied status does not', () => {
  assert.equal(pushPermissionGranted({ ios: { status: 2 } }), true);
  assert.equal(pushPermissionGranted({ ios: { status: 3 } }), true);
  assert.equal(pushPermissionGranted({ ios: { status: 1 } }), false);
  assert.equal(permissionLabel({ ios: { status: 3 } }), 'Allowed quietly by iPhone');
});
