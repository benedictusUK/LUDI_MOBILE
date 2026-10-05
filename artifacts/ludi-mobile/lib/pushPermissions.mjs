export const PUSH_DEFAULTS = {
  pushNotificationsIOS: false, newEvents: true, eventChanges: true,
  paymentReminders: true, flareGunReminders: false,
};

export function pushPermissionGranted(permission) {
  // iOS provisional authorization permits quiet notifications.
  return permission?.granted === true || [2, 3].includes(permission?.ios?.status);
}

export async function getPushPermission(notifications, ask = false) {
  const permission = await notifications.getPermissionsAsync();
  if (ask && !pushPermissionGranted(permission) && permission.canAskAgain) {
    return notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return permission;
}

export async function readPushPreferences(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Could not save notification preferences.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The server returned invalid notification preferences.');
  }
  return { ...PUSH_DEFAULTS, ...data };
}

export function permissionLabel(permission) {
  if (permission?.ios?.status === 3) return 'Allowed quietly by iPhone';
  if (pushPermissionGranted(permission)) return 'Allowed by iPhone';
  if (permission?.status === 'denied' || permission?.ios?.status === 1) return 'Denied in iPhone Settings';
  return 'Not requested yet';
}
