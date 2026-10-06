import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createPushRegistrationQueue, getApplePushRegistration } from './pushRegistration.mjs';

test('registration calls exist in the installed Expo SDK, not just in mocks', () => {
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--ignoreConfig', '--allowJs', '--checkJs', '--noEmit', '--skipLibCheck',
    '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022',
    fileURLToPath(new URL('./pushRegistration.mjs', import.meta.url)),
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
});

function fixture(serviceEnvironment, releaseType = 5) {
  return {
    notifications: { getDevicePushTokenAsync: async () => ({ type: 'ios', data: 'fixture-token' }) },
    application: {
      applicationId: 'app.replit.ludi',
      ApplicationReleaseType: { APP_STORE: 5 },
      getIosPushNotificationServiceEnvironmentAsync: async () => serviceEnvironment,
      getIosApplicationReleaseTypeAsync: async () => releaseType,
    },
  };
}

for (const [native, expected] of [['development', 'sandbox'], ['production', 'production']]) {
  test(`explicit ${native} environment registers against ${expected}`, async () => {
    const { notifications, application } = fixture(native);
    application.getIosApplicationReleaseTypeAsync = async () => { throw new Error('Should not inspect release type'); };
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

test('token events use the supplied native token without requesting another', async () => {
  const { notifications, application } = fixture('production');
  notifications.getDevicePushTokenAsync = async () => { throw new Error('Would recursively emit another token event'); };
  const result = await getApplePushRegistration(notifications, application, { type: 'ios', data: 'event-token' });
  assert.equal(result.token, 'event-token');
});

test('native registration emitting a token event shares the same job rather than recursing', async () => {
  const { notifications, application } = fixture(null);
  let nativeRequests = 0;
  let serverRequests = 0;
  let eventJob;
  const register = createPushRegistrationQueue(async token => {
    const result = await getApplePushRegistration(notifications, application, token);
    serverRequests++;
    return result;
  });
  notifications.getDevicePushTokenAsync = async () => {
    nativeRequests++;
    const token = { type: 'ios', data: 'fixture-token' };
    eventJob = register(token);
    return token;
  };
  const initialJob = register();
  await initialJob;
  assert.equal(eventJob, initialJob);
  assert.equal(nativeRequests, 1);
  assert.equal(serverRequests, 1);
});

test('overlapping foreground refreshes share one registration', async () => {
  let calls = 0;
  const register = createPushRegistrationQueue(async () => {
    calls++;
    return { token: 'fixture-token' };
  });
  const jobs = Array.from({ length: 20 }, () => register());
  assert.ok(jobs.every(job => job === jobs[0]));
  await Promise.all(jobs);
  assert.equal(calls, 1);
});

test('a real token rotation during a pending request registers the latest token next', async () => {
  const tokens = [];
  let release;
  const paused = new Promise(resolve => { release = resolve; });
  const register = createPushRegistrationQueue(async token => {
    tokens.push(token.data);
    if (tokens.length === 1) await paused;
    return { token: token.data };
  });
  const job = register({ type: 'ios', data: 'old-token' });
  await Promise.resolve();
  register({ type: 'ios', data: 'intermediate-token' });
  register({ type: 'ios', data: 'latest-token' });
  release();
  await job;
  assert.deepEqual(tokens, ['old-token', 'latest-token']);
});

test('a failed registration clears the job so an explicit retry can succeed', async () => {
  let attempts = 0;
  const register = createPushRegistrationQueue(async () => {
    if (++attempts === 1) throw new Error('Network failure');
    return { token: 'fixture-token' };
  });
  await assert.rejects(register(), /Network failure/);
  assert.equal((await register()).token, 'fixture-token');
  assert.equal(attempts, 2);
});

test('a stale account registration that aborts does not process queued token changes', async () => {
  let calls = 0;
  const register = createPushRegistrationQueue(async () => { calls++; return undefined; });
  const job = register();
  register({ type: 'ios', data: 'rotated-token' });
  await job;
  assert.equal(calls, 1);
});
