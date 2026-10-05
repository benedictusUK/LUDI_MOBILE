import React, { useEffect } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BrandText as Text } from './brand/BrandText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homePalette, useBrandTypography } from './home/brand';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

export default function HeaderWithNotifications({ title, showBack = false }) {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount, updateUnreadCount } = useNotifications();

  useEffect(() => {
    fetchInitialCount();
  }, []);

  const fetchInitialCount = async () => {
    try {
      const response = await apiRequest('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        const unread = data.filter(n => !n.isRead).length;
        updateUnreadCount(unread);
      }
    } catch (error) {
      // Silently fail — badge count is non-critical
    }
  };

  const handleNotificationsPress = () => {
    navigation.getParent()?.navigate('Notifications');
  };

  const palette = homePalette(isDark);
  const typography = useBrandTypography();
  return (
    <View style={[baseStyles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }, Platform.OS === 'web' && { paddingTop: 8 + Math.max(0, 67 - insets.top) }]}>
      <View style={baseStyles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[baseStyles.backButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={palette.text} />
          </TouchableOpacity>
        )}
        {title === 'Home' ? (
          <View style={baseStyles.logoPlate}>
            <Image
              source={require('../assets/images/ludi-brand-logo.png')}
              style={baseStyles.logo}
              resizeMode="contain"
              accessibilityLabel="LUDI logo"
              testID="signed-in-header-logo"
            />
          </View>
        ) : (
          <Text accessibilityRole="header" style={[typography.display, { color: palette.text, fontSize: 30 }]}>{title}</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={handleNotificationsPress}
        style={[baseStyles.notificationButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
      >
        <Ionicons name="notifications-outline" size={22} color={palette.text} />
        {unreadCount > 0 && (
          <View style={baseStyles.badge}>
            <Text style={[typography.body, baseStyles.badgeText]}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  leftSection: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoPlate: { width: 78, height: 50, borderRadius: 10, backgroundColor: '#0d2036' },
  logo: { width: '100%', height: '100%' },
  notificationButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, borderRadius: 12, backgroundColor: '#42e6b5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#06231e', fontSize: 10, fontWeight: '700' },
});
