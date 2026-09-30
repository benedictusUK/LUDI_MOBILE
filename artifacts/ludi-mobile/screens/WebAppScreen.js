import React from 'react';
import { WebView } from 'react-native-webview';

export default function WebAppScreen() {
  const uri = process.env.EXPO_PUBLIC_WEB_APP_URL || `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  return <WebView source={{ uri }} />;
}
