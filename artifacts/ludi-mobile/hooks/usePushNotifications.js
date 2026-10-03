import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { registerApplePushDevice, unregisterApplePushDevice } from '@workspace/api-client-react';
import { useAuth } from '../contexts/AuthContext';
import { getPushInstallationId } from '../lib/pushDevice';
import { navigationRef } from '../lib/navigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // The existing WebSocket notification toast handles foreground display.
    shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});
const PushContext = createContext(null);
const DEFAULTS = { pushNotificationsIOS: false, newEvents: true, eventChanges: true, paymentReminders: true, flareGunReminders: false };
const available = Platform.OS === 'ios' && Device.isDevice && Constants.executionEnvironment !== 'storeClient';

export function PushNotificationsProvider({ children }) {
  const { user, token, apiRequest } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const pendingTap = useRef(null);
  const currentUser = useRef(user);
  currentUser.current = user;

  const registerDevice = useCallback(async () => {
    if (!available || !token) return;
    const permission = await Notifications.getPermissionsAsync();
    setPermissionGranted(permission.granted);
    const installationId = await getPushInstallationId();
    const headers = { Authorization: `Bearer ${token}` };
    if (!permission.granted) {
      await unregisterApplePushDevice({ installationId }, { headers });
      return;
    }
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const serviceEnvironment = await Application.getIosPushNotificationServiceEnvironmentAsync();
    if (!['development', 'production'].includes(serviceEnvironment)) {
      throw new Error('Push Notifications must be enabled in the signed iPhone build.');
    }
    await registerApplePushDevice({
      token: nativeToken.data, installationId,
      environment: serviceEnvironment === 'development' ? 'sandbox' : 'production',
    }, { headers });
  }, [token]);

  const refresh = useCallback(async () => {
    if (!user || !token) { setPreferences(DEFAULTS); return; }
    setLoading(true);
    try {
      const next = { ...DEFAULTS, ...(await apiRequest('/api/notification-preferences')) };
      setPreferences(next);
      if (available && next.pushNotificationsIOS) await registerDevice();
      setError(null);
    } catch (err) { setError(err.message || 'Could not load notification settings.'); }
    finally { setLoading(false); }
  }, [user?.id, token, registerDevice]);

  useEffect(() => {
    if (user && token) void refresh();
    else { setPreferences(DEFAULTS); setPermissionGranted(false); pendingTap.current = null; }
  }, [user?.id, token, refresh]);

  const setPreference = async (key, value) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (key === 'pushNotificationsIOS') {
        if (!available) throw new Error('Direct Apple push needs a signed LUDI build on a physical iPhone, not Expo Go.');
        if (value) {
          const existing = await Notifications.getPermissionsAsync();
          const permission = existing.granted ? existing
            : existing.canAskAgain ? await Notifications.requestPermissionsAsync() : existing;
          if (!permission.granted) {
            setPermissionGranted(false);
            throw new Error('Allow notifications for LUDI in iPhone Settings, then enable them here.');
          }
          await registerDevice();
        } else {
          await unregisterApplePushDevice({ installationId: await getPushInstallationId() }, { headers: { Authorization: `Bearer ${token}` } });
        }
      }
      const next = await apiRequest('/api/notification-preferences', {
        method: 'PUT', body: JSON.stringify({ [key]: value }),
      });
      setPreferences({ ...DEFAULTS, ...next });
    } catch (err) { setError(err.message || 'Could not save notification settings.'); }
    finally { setBusy(false); }
  };

  const openPendingNotification = useCallback(() => {
    const data = pendingTap.current;
    if (!data || !navigationRef.isReady() || !currentUser.current) return;
    pendingTap.current = null;
    // A notification left on a shared phone must not open a different user's data.
    if (data.userId && data.userId !== currentUser.current.id) return;
    if (data.eventId && data.triggerId !== 'event_cancelled') navigationRef.navigate('EventDetails', { eventId: data.eventId });
    else navigationRef.navigate('Notifications');
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!available) return;
    const rememberTap = response => {
      const raw = response?.notification?.request?.content?.data;
      const data = raw?.data || raw;
      if (data) { pendingTap.current = data; openPendingNotification(); }
    };
    const tapSubscription = Notifications.addNotificationResponseReceivedListener(rememberTap);
    void Notifications.getLastNotificationResponseAsync().then(response => { if (response) rememberTap(response); }).catch(() => {});
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      if (preferences.pushNotificationsIOS) void registerDevice().catch(err => setError(err.message));
    });
    const stateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active' && currentUser.current) void refresh();
    });
    return () => { tapSubscription.remove(); tokenSubscription.remove(); stateSubscription.remove(); };
  }, [token, preferences.pushNotificationsIOS, registerDevice, refresh, openPendingNotification]);

  return (
    <PushContext.Provider value={{
      preferences, available, loading, busy, error, permissionGranted, refresh, setPreference,
      openSystemSettings: () => Linking.openSettings().catch(() => setError('Could not open iPhone Settings.')),
      openPendingNotification,
    }}>
      {children}
    </PushContext.Provider>
  );
}
export function usePushNotifications() { return useContext(PushContext); }