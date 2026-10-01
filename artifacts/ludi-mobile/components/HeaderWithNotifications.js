import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

export default function HeaderWithNotifications({ title, showBack = false }) {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { colors } = useTheme();
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

  return (
    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {title === 'Home' ? (
          <Image
            source={require('../assets/images/ludi-brand-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="LUDI logo"
            testID="signed-in-header-logo"
          />
        ) : (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={handleNotificationsPress}
        style={styles.notificationButton}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#3b82f6', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="notifications-outline" size={24} color="#ffffff" />
        </LinearGradient>
        {unreadCount > 0 && (
          <View style={[styles.badge, { borderColor: colors.card }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  logo: {
    width: 104,
    height: 72,
    borderRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  notificationButton: {
    position: 'relative',
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
