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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
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

  const handleJoinRequestAction = async (notification, action) => {
    try {
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      const { teamId, requestUserId } = metadata;
      
      if (!teamId || !requestUserId) {
        Alert.alert('Error', 'Invalid notification data');
        return;
      }

      setProcessingIds(prev => new Set(prev).add(notification.id));

      const endpoint = action === 'approve' 
        ? `/api/teams/${teamId}/approve-join/${requestUserId}`
        : `/api/teams/${teamId}/reject-join/${requestUserId}`;

      const response = await apiRequest(endpoint, { method: 'POST' });
      
      if (response.ok) {
        Alert.alert(
          'Success', 
          action === 'approve' ? 'Join request approved!' : 'Join request rejected'
        );
        await deleteNotification(notification.id);
        fetchNotifications();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Failed to ${action} join request:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const handleInvitationAction = async (notification, action) => {
    try {
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      const { invitationId } = metadata;
      
      if (!invitationId) {
        Alert.alert('Error', 'Invalid invitation data');
        return;
      }

      setProcessingIds(prev => new Set(prev).add(notification.id));

      const endpoint = action === 'accept' 
        ? `/api/teams/invitations/${invitationId}/accept`
        : `/api/teams/invitations/${invitationId}/decline`;

      const response = await apiRequest(endpoint, { method: 'POST' });
      
      if (response.ok) {
        Alert.alert(
          'Success', 
          action === 'accept' ? 'You have joined the team!' : 'Invitation declined'
        );
        await deleteNotification(notification.id);
        fetchNotifications();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || `Failed to ${action} invitation`);
      }
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
      Alert.alert('Error', `Failed to ${action} invitation`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    try {
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      
      switch (notification.type) {
        case 'new_event':
        case 'event_changed':
        case 'reserve_promotion':
        case 'event':
          if (notification.relatedId) {
            navigation.navigate('EventDetails', { id: notification.relatedId });
          }
          break;
        case 'payment_authorization_required':
          if (metadata.eventId) {
            navigation.navigate('EventDetails', { id: metadata.eventId });
          }
          break;
        case 'team_join_request':
        case 'team_invitation':
          break;
        case 'flare_gun':
          if (notification.relatedId) {
            navigation.navigate('EventDetails', { id: notification.relatedId });
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_event':
      case 'event':
        return { name: 'calendar', color: colors.primary };
      case 'event_changed':
        return { name: 'calendar-outline', color: colors.warning };
      case 'team_join_request':
        return { name: 'person-add', color: colors.primary };
      case 'team_invitation':
        return { name: 'mail', color: colors.success };
      case 'payment_authorization_required':
        return { name: 'card', color: colors.warning };
      case 'flare_gun':
        return { name: 'flame', color: '#f97316' };
      case 'reserve_promotion':
        return { name: 'arrow-up-circle', color: colors.success };
      case 'member_blocked':
        return { name: 'ban', color: colors.error };
      case 'member_unblocked':
        return { name: 'checkmark-circle', color: colors.success };
      case 'system':
        return { name: 'settings', color: colors.textSecondary };
      default:
        return { name: 'notifications', color: colors.primary };
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const mins = Math.floor(diffInHours * 60);
      return mins <= 0 ? 'Just now' : `${mins}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderActionButtons = (notification) => {
    const isProcessing = processingIds.has(notification.id);

    if (notification.type === 'team_join_request') {
      return (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleJoinRequestAction(notification, 'approve')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleJoinRequestAction(notification, 'reject')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (notification.type === 'team_invitation') {
      return (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleInvitationAction(notification, 'accept')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleInvitationAction(notification, 'decline')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <TouchableOpacity 
            style={[styles.markAllButton, { backgroundColor: colors.primary }]} 
            onPress={markAllAsRead}
          >
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        contentContainerStyle={[styles.list, notifications.length === 0 && styles.emptyList]}
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          const icon = getNotificationIcon(item.type);
          return (
            <TouchableOpacity
              style={[
                styles.notificationCard,
                { backgroundColor: colors.card },
                !item.isRead && [styles.unreadCard, { backgroundColor: isDark ? colors.cardSecondary : '#eff6ff' }]
              ]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.notificationHeader}>
                <View style={[styles.notificationIcon, { backgroundColor: icon.color + '20' }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                
                <View style={styles.notificationContent}>
                  <Text style={[
                    styles.notificationTitle,
                    { color: colors.text },
                    !item.isRead && styles.unreadTitle
                  ]}>
                    {item.title}
                  </Text>
                  <Text 
                    style={[styles.notificationMessage, { color: colors.textSecondary }]} 
                    numberOfLines={2}
                  >
                    {item.message}
                  </Text>
                  <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>

                {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </View>

              {renderActionButtons(item)}

              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.deleteButtonText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>No notifications</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  markAllButton: {
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
  },
  emptyList: {
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
    marginTop: 12,
  },
  notificationCard: {
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
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
