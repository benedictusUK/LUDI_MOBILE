/**
 * @param {Pick<typeof import('expo-notifications'), 'getDevicePushTokenAsync'>} notifications
 * @param {typeof import('expo-application')} application
 * @param {import('expo-notifications').DevicePushToken} [suppliedToken]
 */
export async function getApplePushRegistration(notifications, application, suppliedToken) {
  // Apple must actually issue a device token. Never substitute a token or
  // suppress entitlement/registration errors from the native API.
  // A token listener must use its event token rather than request another:
  // requesting a token emits another event and would recursively register.
  const nativeToken = suppliedToken === undefined
    ? await notifications.getDevicePushTokenAsync()
    : suppliedToken;
  if (nativeToken?.type !== 'ios' || typeof nativeToken.data !== 'string' || !nativeToken.data.trim()) {
    throw new Error('Apple did not return a valid iPhone push token.');
  }

  const serviceEnvironment = await application.getIosPushNotificationServiceEnvironmentAsync();
  let environment;
  if (serviceEnvironment === 'development') {
    environment = 'sandbox';
  } else if (serviceEnvironment === 'production') {
    environment = 'production';
  } else if (serviceEnvironment == null) {
    // expo-application reads embedded.mobileprovision, not the live signed
    // entitlement. Store installs may lack that file despite valid APNs access.
    const releaseType = await application.getIosApplicationReleaseTypeAsync();
    if (releaseType === application.ApplicationReleaseType.APP_STORE) {
      environment = 'production';
    }
  }
  if (!environment) {
    throw new Error('Could not determine the Apple push environment for this signed iPhone build.');
  }
  if (!application.applicationId) {
    throw new Error('Could not identify the signed iPhone app.');
  }
  return { token: nativeToken.data, environment, bundleId: application.applicationId };
}

/**
 * Share overlapping registration work and retain genuine token rotations
 * received while a request is pending.
 * @param {(token?: import('expo-notifications').DevicePushToken) => Promise<{token: string} | undefined>} register
 */
export function createPushRegistrationQueue(register) {
  /** @type {{ latestToken: import('expo-notifications').DevicePushToken | undefined, promise: Promise<{token: string} | undefined> } | null} */
  let flight = null;
  /** @param {import('expo-notifications').DevicePushToken} [suppliedToken] */
  function enqueue(suppliedToken) {
    if (flight) {
      if (suppliedToken !== undefined) flight.latestToken = suppliedToken;
      return flight.promise;
    }
    const next = { latestToken: suppliedToken, promise: Promise.resolve(/** @type {{token: string} | undefined} */ (undefined)) };
    // Assign the flight before native code can emit a synchronous token event.
    next.promise = Promise.resolve().then(async () => {
      let result = await register(next.latestToken);
      while (result && next.latestToken && next.latestToken.data !== result.token) {
        result = await register(next.latestToken);
      }
      return result;
    }).finally(() => {
      if (flight === next) flight = null;
    });
    flight = next;
    return next.promise;
  }
  return enqueue;
}
