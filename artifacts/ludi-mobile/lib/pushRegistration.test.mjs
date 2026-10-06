import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApplePushRegistration } from './pushRegistration.mjs';

function fixture(serviceEnvironment, releaseType = 5) {
  return {
    notifications: { getDevicePushTokenAsync: async () => ({ type: 'ios', data: 'fixture-token' }) },
    application: {
      applicationId: 'app.replit.ludi',
      ApplicationReleaseType: { APP_STORE: 5 },
      getIosPushNotificationServiceEnvironmentAsync: async () => serviceEnvironment,
      getApplicationReleaseTypeAsync: async () => releaseType,
    },
  };
}

for (const [native, expected] of [['development', 'sandbox'], ['production', 'production']]) {
  test(`explicit ${native} environment registers against ${expected}`, async () => {
    const { notifications, application } = fixture(native);
    application.getApplicationReleaseTypeAsync = async () => { throw new Error('Should not inspect release type'); };
    assert.deepEqual(await getApplePushRegistration(notifications, application), {
      token: 'fixture-token', environment: expected, bundleId: 'app.replit.ludi',
    });
  });
}

test('store install with no embedded profile uses production after Apple issues a token', async () => {
  const { notifications, application } = fixture(null);
  assert.equal((await getApplePushRegistration(notifications, application)).environment, 'production');
});

for (const releaseType of [0, 1, 2, 3, 4]) {
  test(`missing profile does not guess an environment for non-store release ${releaseType}`, async () => {
    const { notifications, application } = fixture(null, releaseType);
    await assert.rejects(getApplePushRegistration(notifications, application), /Could not determine/);
  });
}

test('an unsupported explicit environment fails even for a store release', async () => {
  const { notifications, application } = fixture('unexpected');
  await assert.rejects(getApplePushRegistration(notifications, application), /Could not determine/);
});

test('native APNs registration failure is preserved without attempting a fallback', async () => {
  const { notifications, application } = fixture(null);
  notifications.getDevicePushTokenAsync = async () => { throw new Error('Missing APNs entitlement'); };
  application.getIosPushNotificationServiceEnvironmentAsync = async () => { throw new Error('Should not inspect environment'); };
  await assert.rejects(getApplePushRegistration(notifications, application), /Missing APNs entitlement/);
});

test('invalid tokens cannot use the store fallback', async () => {
  const { notifications, application } = fixture(null);
  for (const token of [null, { type: 'ios', data: '' }, { type: 'android', data: 'fixture-token' }]) {
    notifications.getDevicePushTokenAsync = async () => token;
    await assert.rejects(getApplePushRegistration(notifications, application), /valid iPhone push token/);
  }
});

test('registration requires the actual native bundle identifier', async () => {
  const { notifications, application } = fixture('production');
  application.applicationId = null;
  await assert.rejects(getApplePushRegistration(notifications, application), /Could not identify/);
});
