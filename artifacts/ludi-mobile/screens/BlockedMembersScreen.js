import React, { useEffect, useState } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import UserAvatar from '../components/UserAvatar';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { BrandText as Text } from '../components/brand/BrandText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function BlockedMembersScreen() {
  const styles = useBrandStyles(baseStyles);
  const route = useRoute();
  const navigation = useNavigation();
  const { teamId, teamName } = route.params;
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblocking, setUnblocking] = useState(null);

  const fetchBlockedMembers = async () => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/blocked`);
      if (response.ok) {
        const data = await response.json();
        setBlockedMembers(data || []);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to load blocked members');
      }
    } catch (error) {
      console.error('Failed to fetch blocked members:', error);
      Alert.alert('Error', 'Unable to load blocked members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBlockedMembers();
  }, [teamId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBlockedMembers();
  };

  const handleUnblock = async (userId, userName) => {
    Alert.alert(
      'Unblock Member',
      `Are you sure you want to unblock ${userName}? They will be able to request to join the team again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(userId);
            try {
              const response = await apiRequest(`/api/teams/${teamId}/block/${userId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                Alert.alert('Success', `${userName} has been unblocked`);
                fetchBlockedMembers();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'Failed to unblock member');
              }
            } catch (error) {
              console.error('Failed to unblock member:', error);
              Alert.alert('Error', 'Failed to unblock member');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  };

  const renderBlockedMember = ({ item }) => {
    const userName = item.user?.firstName && item.user?.lastName
      ? `${item.user.firstName} ${item.user.lastName}`
      : item.user?.username || 'Unknown User';

    const blockedByName = item.blockedBy?.firstName && item.blockedBy?.lastName
      ? `${item.blockedBy.firstName} ${item.blockedBy.lastName}`
      : item.blockedBy?.username || 'Unknown';

    return (
      <View style={[styles.memberCard, { backgroundColor: colors.card }]} data-testid={`card-blocked-${item.userId}`}>
        <View style={styles.memberInfo}>
          <UserAvatar user={item.user} size={48} style={styles.avatar} />
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: colors.text }]}>{userName}</Text>
            {item.user?.username && (
              <Text style={[styles.memberUsername, { color: colors.textSecondary }]}>@{item.user.username}</Text>
            )}
            <Text style={[styles.blockedInfo, { color: colors.textSecondary }]}>
              Blocked by {blockedByName}
            </Text>
            {item.blockedAt && (
              <Text style={[styles.blockedDate, { color: colors.textSecondary }]}>
                {new Date(item.blockedAt).toLocaleDateString()}
              </Text>
            )}
            {item.reason && (
              <Text style={[styles.blockedReason, { color: colors.textSecondary }]}>
                Reason: {item.reason}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.unblockButton, { backgroundColor: isDark ? 'rgba(66, 230, 181, 0.16)' : '#dff3ec', borderColor: '#0f9d78' }]}
          onPress={() => handleUnblock(item.userId, userName)}
          disabled={unblocking === item.userId}
          data-testid={`button-unblock-${item.userId}`}
        >
          {unblocking === item.userId ? (
            <Text style={[styles.unblockButtonText, { color: '#0f9d78' }]}>...</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#0f9d78" />
              <Text style={[styles.unblockButtonText, { color: '#0f9d78' }]}>Unblock</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Members</Text>
          {teamName && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{teamName}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading blocked members...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={blockedMembers}
          keyExtractor={(item) => item.userId || item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={renderBlockedMember}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No blocked members</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Members who are blocked from this team will appear here
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 14,
    marginBottom: 4,
  },
  blockedInfo: {
    fontSize: 12,
  },
  blockedDate: {
    fontSize: 12,
    marginTop: 2,
  },
  blockedReason: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
