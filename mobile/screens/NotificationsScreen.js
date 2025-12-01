import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  const fetchNotifications = async () => {
    try {
      const response = await apiRequest('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data || []);
      } else {
        Alert.alert('Error', 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      Alert.alert('Error', 'Unable to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      if (response.ok) {
        // Update the notification in local state
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, isRead: true, readAt: new Date().toISOString() }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await apiRequest(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Remove the notification from local state
        setNotifications(prev =>
          prev.filter(notification => notification.id !== notificationId)
        );
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiRequest('/api/notifications/mark-all-read', {
        method: 'PUT',
      });
      if (response.ok) {
        // Update all notifications in local state
        setNotifications(prev =>
          prev.map(notification => ({
            ...notification,
            isRead: true,
            readAt: new Date().toISOString(),
          }))
        );
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Handle different notification types
    try {
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      
      switch (notification.type) {
        case 'event':
          if (notification.relatedId) {
            navigation.navigate('EventDetails', { id: notification.relatedId });
          }
          break;
        case 'payment_authorization_required':
          if (metadata.eventId) {
            navigation.navigate('Payment', {
              eventId: metadata.eventId,
              amount: metadata.amount,
              description: `Payment for ${metadata.eventName}`,
            });
          }
          break;
        case 'team':
          // Could navigate to team details if implemented
          break;
        default:
          // Just mark as read, no navigation
          break;
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'event': return '📅';
      case 'team': return '👥';
      case 'payment_authorization_required': return '💳';
      case 'flare_gun': return '🔥';
      case 'system': return '⚙️';
      default: return '📢';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications...</Text>
      </View>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={[styles.markAllButton, { backgroundColor: colors.primary }]} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notificationCard,
              !item.isRead && styles.unreadCard
            ]}
            onPress={() => handleNotificationPress(item)}
          >
            <View style={styles.notificationHeader}>
              <View style={styles.notificationIcon}>
                <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
              </View>
              
              <View style={styles.notificationContent}>
                <Text style={[
                  styles.notificationTitle,
                  !item.isRead && styles.unreadTitle
                ]}>
                  {item.title}
                </Text>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.notificationTime}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>

              {!item.isRead && <View style={styles.unreadDot} />}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  deleteNotification(item.id);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified about events, teams, and payments here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  markAllButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markAllText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  unreadCard: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});