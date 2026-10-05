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
import { PUSH_DEFAULTS, pushPermissionGranted, getPushPermission, readPushPreferences, permissionLabel } from '../lib/pushPermissions.mjs';

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const data = notification.request.content.data;
    // Self-tests have no WebSocket toast. Show them even with LUDI open.
    const isTest = (data?.data || data)?.triggerId === 'test';
    return {
      shouldShowBanner: isTest, shouldShowList: true, shouldPlaySound: isTest, shouldSetBadge: false,
    };
  },
});
const PushContext = createContext(null);
const DEFAULTS = PUSH_DEFAULTS;
const available = Platform.OS === 'ios' && Device.isDevice && Constants.executionEnvironment !== 'storeClient';

export function PushNotificationsProvider({ children }) {
  const { user, token, apiRequest } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('Not requested yet');
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const pendingTap = useRef(null);
  const currentUser = useRef(user);
  currentUser.current = user;
  const currentToken = useRef(token);
  currentToken.current = token;
  const preferenceRevision = useRef(0);
  const preferenceBusy = useRef(false);

  const registerDevice = useCallback(async () => {
    if (!available || !token) return;
    const isCurrent = () => currentUser.current?.id === user?.id && currentToken.current === token;
    setDeviceRegistered(false);
    const permission = await getPushPermission(Notifications);
    if (!isCurrent()) return;
    setPermissionGranted(pushPermissionGranted(permission));
    setPermissionStatus(permissionLabel(permission));
    const installationId = await getPushInstallationId();
    const headers = { Authorization: `Bearer ${token}` };
    if (!pushPermissionGranted(permission)) {
      await unregisterApplePushDevice({ installationId }, { headers });
      return;
    }
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const serviceEnvironment = await Application.getIosPushNotificationServiceEnvironmentAsync();
    if (!isCurrent()) return;
    if (!['development', 'production'].includes(serviceEnvironment)) {
      throw new Error('Push Notifications must be enabled in the signed iPhone build.');
    }
    if (!Application.applicationId) throw new Error('Could not identify the signed iPhone app.');
    await registerApplePushDevice({
      token: nativeToken.data, installationId,
      environment: serviceEnvironment === 'development' ? 'sandbox' : 'production',
      bundleId: Application.applicationId,
    }, { headers });
    if (!isCurrent()) {
      // A registration completing after logout must not attach this shared
      // phone to the previous account. The endpoint filters by token owner.
      await unregisterApplePushDevice({ installationId }, { headers });
      return;
    }
    setDeviceRegistered(true);
  }, [token, user?.id]);

  const refresh = useCallback(async () => {
    if (!user || !token) { setPreferences(DEFAULTS); return; }
    if (preferenceBusy.current) return;
    const revision = preferenceRevision.current;
    const isCurrent = () => currentUser.current?.id === user.id && currentToken.current === token;
    setLoading(true);
    try {
      const next = await readPushPreferences(await apiRequest('/api/notification-preferences'));
      if (!isCurrent() || preferenceBusy.current || revision !== preferenceRevision.current) return;
      setPreferences(next);
      if (available) {
        const permission = await getPushPermission(Notifications);
        if (!isCurrent()) return;
        setPermissionGranted(pushPermissionGranted(permission));
        setPermissionStatus(permissionLabel(permission));
        if (next.pushNotificationsIOS) await registerDevice();
        else setDeviceRegistered(false);
      }
      if (isCurrent()) setError(null);
    } catch (err) { if (isCurrent()) setError(err.message || 'Could not load notification settings.'); }
    finally { if (isCurrent()) setLoading(false); }
  }, [user?.id, token, registerDevice]);

  useEffect(() => {
    preferenceBusy.current = false;
    preferenceRevision.current++;
    setBusy(false);
    setDeviceRegistered(false);
    if (user && token) void refresh();
    else { setPreferences(DEFAULTS); setPermissionGranted(false); setDeviceRegistered(false); setPermissionStatus('Not requested yet'); pendingTap.current = null; }
  }, [user?.id, token, refresh]);

  const setPreference = async (key, value) => {
    if (preferenceBusy.current) return;
    preferenceBusy.current = true;
    preferenceRevision.current++;
    const isCurrent = () => currentUser.current?.id === user?.id && currentToken.current === token;
    setBusy(true);
    setError(null);
    try {
      if (key === 'pushNotificationsIOS') {
        if (!available) throw new Error('Direct Apple push needs a signed LUDI build on a physical iPhone, not Expo Go.');
        if (value) {
          const permission = await getPushPermission(Notifications, true);
          if (!isCurrent()) return;
          setPermissionStatus(permissionLabel(permission));
          if (!pushPermissionGranted(permission)) {
            setPermissionGranted(false);
            throw new Error('Allow notifications for LUDI in iPhone Settings, then enable them here.');
          }
          await registerDevice();
        } else {
          await unregisterApplePushDevice({ installationId: await getPushInstallationId() }, { headers: { Authorization: `Bearer ${token}` } });
          setDeviceRegistered(false);
        }
      }
      if (!isCurrent()) return;
      const response = await apiRequest('/api/notification-preferences', {
        method: 'PUT', body: JSON.stringify({ [key]: value }),
      });
      const next = await readPushPreferences(response);
      if (isCurrent()) setPreferences(next);
    } catch (err) { if (isCurrent()) setError(err.message || 'Could not save notification settings.'); }
    finally {
      if (isCurrent()) {
        preferenceRevision.current++;
        preferenceBusy.current = false;
        setBusy(false);
      }
    }
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
      preferences, available, loading, busy, error, permissionGranted, permissionStatus, deviceRegistered, refresh, setPreference,
      openSystemSettings: () => Linking.openSettings().catch(() => setError('Could not open iPhone Settings.')),
      openPendingNotification,
    }}>
      {children}
    </PushContext.Provider>
  );
}
export function usePushNotifications() { return useContext(PushContext); }