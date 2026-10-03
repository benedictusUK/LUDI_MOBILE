import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setBaseUrl, unregisterApplePushDevice } from '@workspace/api-client-react';
import { API_BASE_URL } from './apiConfig';

setBaseUrl(API_BASE_URL);
const INSTALLATION_KEY = 'ludi-apns-installation-id';
export async function getPushInstallationId() {
  let id = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(INSTALLATION_KEY, id);
  }
  return id;
}
export async function unregisterPushForLogout(token) {
  if (Platform.OS !== 'ios' || !token) return;
  const installationId = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (!installationId) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    await unregisterApplePushDevice({ installationId }, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
}