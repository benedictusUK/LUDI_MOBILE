import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

export default function HeaderWithNotifications({ title }) {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    
    // Refresh unread count when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
    });
    
    return unsubscribe;
  }, [navigation]);

  const fetchUnreadCount = async () => {
    try {
      const response = await apiRequest('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        const unread = data.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to fetch unread notifications count:', error);
    }
  };

  const handleNotificationsPress = () => {
    // Navigate to Notifications at the root stack level
    navigation.getParent()?.navigate('Notifications');
  };

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
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
          <View style={styles.badge}>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  notificationButton: {
    position: 'relative',
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
