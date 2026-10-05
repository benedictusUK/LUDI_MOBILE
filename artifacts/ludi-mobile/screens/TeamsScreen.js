import React, { useCallback, useEffect, useRef, useState } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { BrandText as Text } from '../components/brand/BrandText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import TeamAvatar from '../components/team/TeamAvatar';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

export default function TeamsScreen() {
  const styles = useBrandStyles(baseStyles, { navClearance: 112 });
  const [teams, setTeams] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('myTeams');
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();

  const fetchTeams = async () => {
    try {
      const response = await apiRequest('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data || []);
      } else {
        Alert.alert('Error', 'Failed to load teams');
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      Alert.alert('Error', 'Unable to load teams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPendingRequests = async (force = false) => {
    if (pendingLoaded && !force) return;

    setPendingLoading(true);
    try {
      const [response, invitationsResponse] = await Promise.all([
        apiRequest('/api/teams/my-pending-requests'), apiRequest('/api/users/invitations'),
      ]);
      if (response.ok && invitationsResponse.ok) {
        const [data, invitations] = await Promise.all([response.json(), invitationsResponse.json()]);
        if (!Array.isArray(data) || !Array.isArray(invitations)) throw new Error('Invalid pending team data');
        setPendingRequests([...invitations, ...data]);
        setPendingLoaded(true);
      } else {
        Alert.alert('Error', 'Failed to load pending requests');
      }
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
      Alert.alert('Error', 'Unable to load pending requests');
    } finally {
      setPendingLoading(false);
    }
  };

  const firstFocus = useRef(true);
  const fetchTeamsRef = useRef(fetchTeams);
  fetchTeamsRef.current = fetchTeams;
  const refreshPendingRef = useRef(() => {});
  refreshPendingRef.current = () => { if (activeTab === 'pending') fetchPendingRequests(true); };
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    fetchTeamsRef.current();
    refreshPendingRef.current();
  }, []));
  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingRequests();
    }
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'myTeams') {
      fetchTeams();
    } else {
      fetchPendingRequests(true).finally(() => setRefreshing(false));
    }
  };

  const renderTeamItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.teamCard, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('TeamDetails', { teamId: item.id })}
      data-testid={`card-team-${item.id}`}
    >
      <View style={styles.teamHeader}>
        <View style={[styles.teamColor, { backgroundColor: item.color || '#3d86e8' }]} />
        <View style={styles.teamInfo}>
          <Text style={[styles.teamName, { color: colors.text }]}>{item.name}</Text>
          {item.description && (
            <Text style={[styles.teamDescription, { color: colors.textSecondary }]}>{item.description}</Text>
          )}
        </View>
        <TeamAvatar team={item} size={48} radius={14} style={styles.teamPicture} />
      </View>
      
      <View style={styles.teamFooter}>
        <View style={styles.sportsContainer}>
          {item.sports?.slice(0, 3).map((sport, index) => (
            <Text key={index} style={[styles.sportTag, { color: colors.primary, backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
              {sport}
            </Text>
          ))}
          {item.sports?.length > 3 && (
            <Text style={[styles.sportTag, { color: colors.primary, backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>+{item.sports.length - 3}</Text>
          )}
        </View>
        
        <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
          {item.memberCount || 0} members
        </Text>
      </View>
    </TouchableOpacity>
  );

  const respondToInvitation = async (id, accept) => {
    if (respondingId) return;
    setRespondingId(id);
    try {
      const response = await apiRequest(`/api/invitations/${encodeURIComponent(id)}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to respond to invitation');
      await Promise.all([fetchTeams(), fetchPendingRequests(true)]);
      Alert.alert('Success', `${accept ? 'You have joined the team' : 'Invitation declined'}${data.notificationWarning ? `\n${data.notificationWarning}` : ''}`);
    } catch (error) { Alert.alert('Error', error.message || 'Unable to respond to invitation'); }
    finally { setRespondingId(null); }
  };
  const renderPendingItem = ({ item }) => (
    <View 
      style={[styles.teamCard, { backgroundColor: colors.card }]}
      data-testid={`card-pending-${item.id}`}
    >
      <View style={styles.teamHeader}>
        <View style={[styles.teamColor, { backgroundColor: item.team?.color || '#f59e0b' }]} />
        <View style={styles.teamInfo}>
          <Text style={[styles.teamName, { color: colors.text }]}>{item.team?.name}</Text>
          {item.team?.description && (
            <Text style={[styles.teamDescription, { color: colors.textSecondary }]}>{item.team.description}</Text>
          )}
        </View>
      </View>
      
      <View style={styles.pendingFooter}>
        <View style={[styles.pendingBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7' }]}>
          <Text style={styles.pendingBadgeText}>{item.invitedById === item.userId ? 'Request Pending' : 'Team Invitation'}</Text>
        </View>
        {item.invitedAt && (
          <Text style={[styles.pendingDate, { color: colors.textSecondary }]}>
            {item.invitedById === item.userId ? 'Requested' : 'Invited'} {new Date(item.invitedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      {item.invitedById !== item.userId && <View style={[styles.pendingFooter, { marginTop: 14 }]}>
        {['accept', 'decline'].map(action => <TouchableOpacity key={action}
          accessibilityRole="button" accessibilityLabel={`${action === 'accept' ? 'Accept' : 'Decline'} invitation to ${item.team?.name}`}
          testID={`${action}-team-invitation-${item.id}`} disabled={!!respondingId}
          onPress={() => respondToInvitation(item.id, action === 'accept')}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700', padding: 8 }}>
            {respondingId === item.id ? 'Please wait…' : action === 'accept' ? 'Accept' : 'Decline'}
          </Text>
        </TouchableOpacity>)}
      </View>}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <HeaderWithNotifications title="Teams" />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>Loading teams...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <HeaderWithNotifications title="Teams" />
      
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'myTeams' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('myTeams')}
          data-testid="tab-my-teams"
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'myTeams' ? colors.primary : colors.textSecondary }
          ]}>
            My Teams
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'pending' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('pending')}
          data-testid="tab-pending-requests"
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'pending' ? colors.primary : colors.textSecondary }
          ]}>
            Invitations & Requests
          </Text>
          {pendingLoaded && pendingRequests.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{pendingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {activeTab === 'myTeams' ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={teams}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={renderTeamItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={[styles.emptyText, { color: colors.text }]}>No teams yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Create or join a team to start organising events!
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={pendingRequests}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing || pendingLoading} onRefresh={onRefresh} />
          }
          renderItem={renderPendingItem}
          ListEmptyComponent={
            pendingLoading ? (
              <View style={styles.centerContainer}>
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading pending requests...</Text>
              </View>
            ) : (
              <View style={styles.centerContainer}>
                <Text style={[styles.emptyText, { color: colors.text }]}>No pending requests</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Search for teams and request to join!
                </Text>
              </View>
            )
          }
        />
      )}
      
      <View style={styles.fabStack}>
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() => navigation.navigate('TeamSearch')}
          activeOpacity={0.8}
          data-testid="button-search-teams"
        >
          <View style={[styles.fabSecondaryInner, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Ionicons name="search" size={22} color={colors.primary} />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => navigation.navigate('CreateTeam')}
          activeOpacity={0.8}
          data-testid="button-create-team"
        >
          <View style={[styles.fab, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={30} color={colors.buttonText} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  badgeCount: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  teamCard: {
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
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamPicture: {
    marginLeft: 'auto',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  teamDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d97706',
  },
  pendingDate: {
    fontSize: 12,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 12,
  },
  sportTag: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#6b7280',
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
  fabStack: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  fabSecondary: {
    marginBottom: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabSecondaryInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  fabSecondaryIcon: {
    fontSize: 20,
  },
  fabContainer: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
});
