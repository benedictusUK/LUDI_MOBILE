import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { signOut } = useAuth();
  const navigation = useNavigation();

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
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
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

const styles = StyleSheet.create({
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
