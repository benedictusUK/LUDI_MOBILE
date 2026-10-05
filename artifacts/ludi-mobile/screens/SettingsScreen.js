import React from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { BrandText as Text } from '../components/brand/BrandText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function SettingsScreen() {
  const styles = useBrandStyles(baseStyles);
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const push = usePushNotifications();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            iPhone permission: {push.available ? push.permissionStatus : 'Requires a signed build on a physical iPhone'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Device registration: {push.deviceRegistered ? 'Registered for this account' : 'Not registered'}
          </Text>
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingLeft, { flex: 1 }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              <Text style={[styles.settingText, { color: colors.text, flex: 1 }]}>iPhone push notifications</Text>
            </View>
            <Switch
              accessibilityLabel="Enable iPhone push notifications"
              testID="switch-apple-push"
              value={push.preferences.pushNotificationsIOS && push.permissionGranted}
              disabled={!push.available || push.loading || push.busy}
              onValueChange={value => push.setPreference('pushNotificationsIOS', value)}
            />
          </View>
          {push.available && push.preferences.pushNotificationsIOS && !push.deviceRegistered ? (
            <TouchableOpacity onPress={push.refresh} disabled={push.loading || push.busy}
              accessibilityRole="button" testID="button-retry-push-registration" style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.primary }}>Retry device registration</Text>
            </TouchableOpacity>
          ) : null}
          {!push.available && (
            <Text style={{ color: colors.textSecondary, padding: 16 }}>
              Direct Apple push needs a signed LUDI build on a physical iPhone. It is not available in Expo Go or the web preview.
            </Text>
          )}
          {push.available && !push.permissionGranted && (
            <TouchableOpacity onPress={push.openSystemSettings} accessibilityRole="button" style={{ padding: 16 }}>
              <Text style={{ color: colors.primary }}>Open iPhone notification settings</Text>
            </TouchableOpacity>
          )}
          {[
            ['newEvents', 'New events and event reminders'],
            ['eventChanges', 'Event changes and cancellations'],
            ['paymentReminders', 'Payment notifications'],
            ['flareGunReminders', 'Nearby player flares'],
          ].map(([key, label]) => (
            <View key={key} style={[styles.settingItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.settingText, { color: colors.text, flex: 1, marginRight: 12 }]}>{label}</Text>
              <Switch accessibilityLabel={label} testID={`switch-notification-${key}`}
                value={!!push.preferences[key]} disabled={push.loading || push.busy}
                onValueChange={value => push.setPreference(key, value)} />
            </View>
          ))}
          <Text style={{ color: colors.textSecondary, padding: 16 }}>
            Push is optional. Important payment updates remain in your LUDI inbox.
          </Text>
          {push.error && <Text accessibilityRole="alert" style={{ color: colors.error, padding: 16 }}>{push.error}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={push.refresh} disabled={push.busy || push.loading} style={{ padding: 16 }}>
            <Text style={{ color: colors.primary }}>{push.loading ? 'Loading settings…' : 'Refresh notification settings'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => handleThemeChange('light')}
            data-testid="button-theme-light"
          >
            <View style={styles.settingLeft}>
              <Ionicons name="sunny-outline" size={22} color={colors.text} />
              <Text style={[styles.settingText, { color: colors.text }]}>Light Mode</Text>
            </View>
            {themeMode === 'light' && (
              <Ionicons name="checkmark" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => handleThemeChange('dark')}
            data-testid="button-theme-dark"
          >
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={22} color={colors.text} />
              <Text style={[styles.settingText, { color: colors.text }]}>Dark Mode</Text>
            </View>
            {themeMode === 'dark' && (
              <Ionicons name="checkmark" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={() => handleThemeChange('system')}
            data-testid="button-theme-system"
          >
            <View style={styles.settingLeft}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.text} />
              <Text style={[styles.settingText, { color: colors.text }]}>System Default</Text>
            </View>
            {themeMode === 'system' && (
              <Ionicons name="checkmark" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Payments</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={() => navigation.navigate('PaymentMethods')}
            data-testid="button-payment-methods"
          >
            <View style={styles.settingLeft}>
              <Ionicons name="card-outline" size={22} color={colors.text} />
              <Text style={[styles.settingText, { color: colors.text }]}>Payment Methods</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={handleLogout}
            data-testid="button-logout"
          >
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text style={[styles.settingText, { color: '#ef4444' }]}>Log Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>LUDI v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    padding: 32,
  },
  versionText: {
    fontSize: 13,
  },
});
