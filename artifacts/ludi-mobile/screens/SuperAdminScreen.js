import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getPlatformAdminAccess, setBaseUrl } from '@workspace/api-client-react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AdminSessionContext } from '../contexts/AdminSessionContext';
import { API_BASE_URL } from '../lib/apiConfig';
import { isAccessDenied, isVerifiedAdmin } from '../lib/adminAccess.mjs';
import { BrandText as Text } from '../components/brand/BrandText';
import useBrandStyles from '../components/brand/useBrandStyles';
import SuperAdminContent from './admin/SuperAdminContent';

setBaseUrl(API_BASE_URL);

export default function SuperAdminScreen({ navigation }) {
  const { user, token } = useAuth();
  // Remount on account/session changes so no previous admin's drafts, data or
  // pending requests are ever offered to the next account.
  if (!user?.id || !token) return null;
  return <VerifiedAdmin key={`${user.id}:${token}`} navigation={navigation} userId={user.id} token={token} />;
}

function VerifiedAdmin({ navigation, userId, token }) {
  const { colors } = useTheme();
  const styles = useBrandStyles(baseStyles);
  const [access, setAccess] = useState('loading');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  }));
  useEffect(() => () => { client.cancelQueries(); client.clear(); }, [client]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    setAccess('loading');
    getPlatformAdminAccess({ ...request, signal: controller.signal }).then(result => {
      if (active) setAccess(isVerifiedAdmin(result, userId) ? 'allowed' : 'denied');
    }).catch(error => {
      if (!active) return;
      setMessage(error.name === 'AbortError' ? 'Access check timed out. Check your connection and try again.' : error?.data?.message || error.message || 'Please check your connection and try again.');
      setAccess(isAccessDenied(error) ? 'denied' : 'error');
    }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      setAccess('loading');
      client.cancelQueries();
      client.clear();
    };
  }, [request, userId, retry, client]));

  const onAccessError = useCallback(error => {
    if (isAccessDenied(error)) {
      setAccess('denied');
      client.cancelQueries();
      client.clear();
    }
  }, [client]);
  const session = useMemo(() => ({ request, onAccessError }), [request, onAccessError]);

  if (access === 'allowed') return (
    <QueryClientProvider client={client}>
      <AdminSessionContext.Provider value={session}>
        <KeyboardProvider>
          <SuperAdminContent navigation={navigation} />
        </KeyboardProvider>
      </AdminSessionContext.Provider>
    </QueryClientProvider>
  );
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.button}>
        <Text style={{ color: colors.primary }}>Back to Profile</Text>
      </TouchableOpacity>
      <View style={styles.state}>
        {access === 'loading' ? (
          <><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.textSecondary }]}>Checking SuperAdmin access…</Text></>
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {access === 'denied' ? 'SuperAdmin access required' : 'Could not check access'}
            </Text>
            <Text accessibilityRole="alert" style={[styles.body, { color: colors.textSecondary }]}>
              {access === 'denied' ? 'These controls are only available to LUDI platform administrators.' : message}
            </Text>
            {access === 'error' && <TouchableOpacity accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.buttonText }}>Retry access check</Text>
            </TouchableOpacity>}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  state: { flex: 1, justifyContent: 'center', gap: 18 },
  button: { minHeight: 48, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
});
