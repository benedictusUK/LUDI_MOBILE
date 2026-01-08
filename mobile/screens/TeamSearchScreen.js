import { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

export default function TeamSearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [joiningTeamId, setJoiningTeamId] = useState(null);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();

  const searchTeams = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest(`/api/teams/search?q=${encodeURIComponent(query.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [apiRequest]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    searchTeams(text);
  };

  const handleJoinRequest = async (team) => {
    setJoiningTeamId(team.id);
    try {
      const response = await apiRequest(`/api/teams/${team.id}/request-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', data.message || 'Join request sent successfully');
        searchTeams(searchQuery);
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.message || 'Failed to send join request');
      }
    } catch (error) {
      console.error('Join request error:', error);
      Alert.alert('Error', 'Failed to send join request');
    } finally {
      setJoiningTeamId(null);
    }
  };

  const renderTeamItem = ({ item }) => {
    const isMember = item.isMember;
    const isPrivate = item.isPrivate;
    const requiresApproval = item.requiresApproval;
    const hasPendingRequest = item.hasPendingRequest;

    return (
      <TouchableOpacity
        style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
        onPress={() => isMember ? navigation.navigate('TeamDetails', { teamId: item.id }) : null}
        activeOpacity={isMember ? 0.7 : 1}
      >
        <View style={styles.teamHeader}>
          <View style={[styles.teamColor, { backgroundColor: item.color || '#3b82f6' }]} />
          <View style={styles.teamInfo}>
            <Text style={[styles.teamName, { color: colors.text }]}>{item.name}</Text>
            {item.description && (
              <Text style={[styles.teamDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.teamMeta}>
          <View style={styles.sportsContainer}>
            {item.sports?.slice(0, 2).map((sport, index) => (
              <View key={index} style={[styles.sportTag, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' }]}>
                <Text style={[styles.sportTagText, { color: colors.primary }]}>{sport}</Text>
              </View>
            ))}
            {item.sports?.length > 2 && (
              <View style={[styles.sportTag, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' }]}>
                <Text style={[styles.sportTagText, { color: colors.primary }]}>+{item.sports.length - 2}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
            {item.memberCount || 0} members
          </Text>
        </View>

        <View style={styles.teamFooter}>
          {isMember ? (
            <View style={[styles.memberBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          ) : isPrivate ? (
            <View style={[styles.privateBadge, { backgroundColor: isDark ? 'rgba(107, 114, 128, 0.2)' : '#f3f4f6' }]}>
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
              <Text style={[styles.privateBadgeText, { color: colors.textSecondary }]}>Private Team</Text>
            </View>
          ) : hasPendingRequest ? (
            <View style={[styles.pendingBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7' }]}>
              <Ionicons name="time" size={16} color="#f59e0b" />
              <Text style={styles.pendingBadgeText}>Request Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, joiningTeamId === item.id && styles.joinButtonDisabled]}
              onPress={() => handleJoinRequest(item)}
              disabled={joiningTeamId === item.id}
            >
              {joiningTeamId === item.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name={requiresApproval ? "paper-plane" : "add-circle"} size={18} color="#ffffff" />
                  <Text style={styles.joinButtonText}>
                    {requiresApproval ? 'Request to Join' : 'Join Team'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <HeaderWithNotifications title="Find Teams" showBack />

      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search for teams..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.searchingText, { color: colors.textSecondary }]}>Searching...</Text>
        </View>
      ) : searchQuery.length < 2 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search" size={64} color={isDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for teams</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Enter at least 2 characters to search
          </Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={isDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No teams found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTeamItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingTop: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  searchingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  teamCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  teamColor: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  teamMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sportTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sportTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberCount: {
    fontSize: 13,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  memberBadgeText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  privateBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  pendingBadgeText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
