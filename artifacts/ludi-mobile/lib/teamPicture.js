import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';
import { API_BASE_URL } from './apiConfig';

const MAX_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function getTeamPictureUri(path) {
  if (!path) return null;
  if (path.startsWith('/objects/')) return `${API_BASE_URL}${path}`;
  return /^https:\/\//i.test(path) ? path : null;
}

export async function pickTeamPicture() {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a picture. You can also continue without a picture.', [
        { text: 'Not now', style: 'cancel' },
        ...(!permission.canAskAgain ? [{
          text: 'Open Settings',
          onPress: () => Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open Settings manually to allow LUDI photo access.')),
        }] : []),
      ]);
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.fileSize > MAX_BYTES) throw new Error('Choose a picture smaller than 5 MB.');
  return asset;
}

export async function uploadTeamPicture(asset, apiRequest) {
  if (!asset?.uri) throw new Error('Please choose a picture first.');
  // A cancelled/retried team submission can reuse its already uploaded picture.
  if (asset.objectPath) return asset.objectPath;
  const local = await fetch(asset.uri);
  if (!local.ok) throw new Error('Could not read the selected picture. Please choose it again.');
  const blob = await local.blob();
  if (blob.size > MAX_BYTES) throw new Error('Choose a picture smaller than 5 MB.');
  const extension = asset.uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  const extensionType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension];
  const contentType = extensionType || asset.mimeType || blob.type || 'image/jpeg';
  if (!SUPPORTED_TYPES.includes(contentType)) throw new Error('Choose a JPEG, PNG or WebP picture.');
  const request = await apiRequest('/api/objects/upload', { method: 'POST' });
  if (!request.ok) throw new Error('Could not prepare the picture upload. Please retry.');
  const { uploadURL, objectPath } = await request.json();
  if (!uploadURL || !objectPath) throw new Error('The picture upload response was incomplete.');
  // PUT bytes directly to persistent storage, never through JSON or PostgreSQL.
  const uploaded = await fetch(uploadURL, {
    method: 'PUT', headers: { 'Content-Type': contentType }, body: blob,
  });
  if (!uploaded.ok) throw new Error('The picture could not be uploaded. Please retry.');
  return objectPath;
}
