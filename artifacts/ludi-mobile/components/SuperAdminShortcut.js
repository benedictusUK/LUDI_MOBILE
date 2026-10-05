import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../lib/apiConfig';
import { BrandText as Text } from './brand/BrandText';
import useBrandStyles from './brand/useBrandStyles';

export default function SuperAdminShortcut() {
  const { user, apiRequest } = useAuth();
  const { colors } = useTheme();
  const styles = useBrandStyles(baseStyles);
  const [access, setAccess] = useState('loading');
  const [opening, setOpening] = useState(false);
  const checkAccess = useCallback(async (active = () => true) => {
    if (!user?.id) { setAccess('none'); return; }
    setAccess('loading');
    try {
      const response = await apiRequest('/api/admin/access');
      if (!response.ok) throw new Error('Could not verify SuperAdmin access.');
      const result = await response.json();
      if (active()) setAccess(result.isSuperAdmin === true ? 'allowed' : 'none');
    } catch {
      if (active()) setAccess('error');
    }
  }, [user?.id, apiRequest]);

  useFocusEffect(useCallback(() => {
    let active = true;
    checkAccess(() => active);
    return () => { active = false; };
  }, [checkAccess]));

  const openAdmin = async () => {
    setOpening(true);
    try {
      // Browser sessions stay separate: never include the app token in a URL.
      await WebBrowser.openBrowserAsync(`${API_BASE_URL}/superadmin/notifications`);
    } catch {
      Alert.alert('Could not open SuperAdmin', 'Please try again or open the LUDI website in your browser.');
    } finally {
      setOpening(false);
    }
  };
  if (access === 'none' || access === 'loading') return null;
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>SuperAdmin</Text>
      {access === 'error' ? (
        <>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Could not check SuperAdmin access.</Text>
          <TouchableOpacity style={styles.button} onPress={() => checkAccess()} accessibilityRole="button">
            <Text style={{ color: colors.primary }}>Retry access check</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={openAdmin} disabled={opening}
            accessibilityRole="button" accessibilityLabel="Open SuperAdmin management on the LUDI website"
            testID="button-superadmin" data-testid="button-superadmin"
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.buttonText} />
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>{opening ? 'Opening…' : 'Open SuperAdmin'}</Text>
            <Ionicons name="open-outline" size={18} color={colors.buttonText} />
          </TouchableOpacity>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Manage notifications and fees on the website. You may need to sign in again in the browser.
          </Text>
        </>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  section: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 16, fontWeight: '600', flex: 1 },
  description: { fontSize: 13, lineHeight: 19, marginTop: 10 },
});
