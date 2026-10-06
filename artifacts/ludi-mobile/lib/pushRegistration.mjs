/**
 * @param {Pick<typeof import('expo-notifications'), 'getDevicePushTokenAsync'>} notifications
 * @param {typeof import('expo-application')} application
 */
export async function getApplePushRegistration(notifications, application) {
  // Apple must actually issue a device token. Never substitute a token or
  // suppress entitlement/registration errors from the native API.
  const nativeToken = await notifications.getDevicePushTokenAsync();
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
