import React, { useState } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl, Modal, ScrollView } from 'react-native';
import { BrandText as Text, BrandTextInput as TextInput } from '../components/brand/BrandText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

const SPORTS = [
  "All Sports",
  "Team Social",
  "Badminton",
  "Basketball",
  "Boxing",
  "Cricket",
  "Cycling", 
  "Fitness Training",
  "Football",
  "Golf",
  "Hiking",
  "Hockey",
  "Martial Arts",
  "Other",
  "Paddle",
  "Rugby",
  "Running",
  "Squash",
  "Swimming",
  "Table Tennis",
  "Tennis",
  "Volleyball",
  "Walking",
  "Wild Camping",
  "Yoga",
];

const RADIUS_OPTIONS = [
  { label: '5 miles', value: '5' },
  { label: '10 miles', value: '10' },
  { label: '15 miles', value: '15' },
  { label: '25 miles', value: '25' },
  { label: '50 miles', value: '50' },
];

export default function SearchScreen() {
  const styles = useBrandStyles(baseStyles, { navClearance: 112 });
  const [activeTab, setActiveTab] = useState('events');
  
  // Event search state
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('10');
  const [sport, setSport] = useState('All Sports');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  
  // Team search state
  const [teamQuery, setTeamQuery] = useState('');
  const [teamResults, setTeamResults] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamHasSearched, setTeamHasSearched] = useState(false);
  
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  const handleEventSearch = async () => {
    if (!postcode.trim()) {
      Alert.alert('Error', 'Please enter a postcode to search');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({ 
        postcode: postcode.trim(), 
        radius,
        sport: sport === 'All Sports' ? '' : sport
      });
      
      const response = await apiRequest(`/api/flare-events?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data || []);
        setHasSearched(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to search events');
      }
    } catch (error) {
      console.error('Failed to search events:', error);
      Alert.alert('Error', 'Unable to search events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTeamSearch = async () => {
    if (!teamQuery.trim() || teamQuery.trim().length < 2) {
      Alert.alert('Error', 'Please enter at least 2 characters to search');
      return;
    }

    try {
      setTeamLoading(true);
      const response = await apiRequest(`/api/teams/search?q=${encodeURIComponent(teamQuery.trim())}`);
      
      if (response.ok) {
        const data = await response.json();
        setTeamResults(data || []);
        setTeamHasSearched(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to search teams');
      }
    } catch (error) {
      console.error('Failed to search teams:', error);
      Alert.alert('Error', 'Unable to search teams');
    } finally {
      setTeamLoading(false);
    }
  };

  const onRefresh = () => {
    if (activeTab === 'events' && hasSearched) {
      setRefreshing(true);
      handleEventSearch();
    }
  };

  const handleFlareResponse = async (eventId, status) => {
    try {
      const response = await apiRequest(`/api/events/${eventId}/flare-response`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        Alert.alert('Success', `Response recorded: ${status}`);
        setResults(prev =>
          prev.map(event =>
            event.id === eventId
              ? { ...event, userResponse: status }
              : event
          )
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to respond');
      }
    } catch (error) {
      console.error('Failed to respond to flare:', error);
      Alert.alert('Error', 'Unable to send response');
    }
  };

  const handleJoinTeam = async (team) => {
    const requiresApproval = !team.isOpen;
    
    try {
      const response = await apiRequest(`/api/teams/${team.id}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        if (requiresApproval) {
          Alert.alert('Request Sent', `Your request to join ${team.name} has been sent to the team admins.`);
          setTeamResults(prev =>
            prev.map(t =>
              t.id === team.id ? { ...t, hasPendingRequest: true } : t
            )
          );
        } else {
          Alert.alert('Success', `You have joined ${team.name}!`);
          setTeamResults(prev => prev.filter(t => t.id !== team.id));
        }
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to join team');
      }
    } catch (error) {
      console.error('Failed to join team:', error);
      Alert.alert('Error', 'Unable to join team');
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    try {
      const date = new Date(dateStr);
      const timeFormatted = timeStr || '12:00';
      return `${date.toLocaleDateString()} at ${timeFormatted}`;
    } catch (error) {
      return dateStr;
    }
  };

  const renderEvent = ({ item }) => (
    <View style={[styles.eventCard, { backgroundColor: colors.card }]} data-testid={`card-event-${item.id}`}>
      <View style={styles.eventHeader}>
        <View style={[styles.flareIndicator, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2' }]}>
          <Text style={styles.flareIcon}>🔥</Text>
          <Text style={[styles.flareText, { color: colors.error }]}>FLARE</Text>
        </View>
        <Text style={[styles.distance, { color: colors.textSecondary }]}>
          {item.distance ? `${item.distance.toFixed(1)} miles` : 'Nearby'}
        </Text>
      </View>

      <Text style={[styles.eventTitle, { color: colors.text }]}>{item.name}</Text>
      
      <View style={styles.eventDetails}>
        <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
          📅 {formatDateTime(item.startDate, item.startTime)}
        </Text>
        {item.location && (
          <Text style={[styles.eventLocation, { color: colors.textSecondary }]}>
            📍 {item.location}
          </Text>
        )}
        <Text style={[styles.eventTeam, { color: colors.textSecondary }]}>
          👥 {item.team?.name || 'Unknown Team'}
        </Text>
      </View>

      <View style={[styles.sportBadge, { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
        <Text style={[styles.sportText, { color: colors.primary }]}>{item.sport}</Text>
      </View>

      {item.requirements && (
        <Text style={[styles.requirements, { color: colors.textSecondary }]} numberOfLines={2}>
          Requirements: {item.requirements}
        </Text>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.responseButton,
            { backgroundColor: isDark ? 'rgba(66, 230, 181, 0.16)' : '#dff3ec', borderColor: colors.success },
            item.userResponse === 'interested' && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => handleFlareResponse(item.id, 'interested')}
          data-testid={`button-interested-${item.id}`}
        >
          <Text style={[
            styles.responseButtonText,
            { color: item.userResponse === 'interested' ? colors.buttonText : colors.text }
          ]}>
            ✓ Interested
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.responseButton,
            { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', borderColor: '#f59e0b' },
            item.userResponse === 'maybe' && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => handleFlareResponse(item.id, 'maybe')}
          data-testid={`button-maybe-${item.id}`}
        >
          <Text style={[
            styles.responseButtonText,
            { color: item.userResponse === 'maybe' ? colors.buttonText : colors.text }
          ]}>
            ? Maybe
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailsButton, { backgroundColor: colors.cardSecondary }]}
          onPress={() => navigation.navigate('EventDetails', { id: item.id })}
          data-testid={`button-view-event-${item.id}`}
        >
          <Text style={[styles.detailsButtonText, { color: colors.textSecondary }]}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTeam = ({ item }) => {
    const requiresApproval = !item.isOpen;
    
    return (
      <View style={[styles.teamCard, { backgroundColor: colors.card }]} data-testid={`card-team-${item.id}`}>
        <View style={styles.teamHeader}>
          <View style={[styles.teamColor, { backgroundColor: item.color || '#3d86e8' }]} />
          <View style={styles.teamInfo}>
            <View style={styles.teamNameRow}>
              <Text style={[styles.teamName, { color: colors.text }]}>{item.name}</Text>
              {item.isMember && (
                <View style={styles.memberBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#0f9d78" />
                  <Text style={styles.memberBadgeText}>Member</Text>
                </View>
              )}
              {requiresApproval && !item.isMember && (
                <View style={[styles.approvalBadge, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.3)' : '#f1f5f9' }]}>
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                </View>
              )}
            </View>
            {item.description && (
              <Text style={[styles.teamDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.teamFooter}>
          <View style={styles.sportsContainer}>
            {item.sports?.slice(0, 2).map((sportItem, index) => (
              <Text key={index} style={[styles.sportTag, { color: colors.primary, backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
                {sportItem}
              </Text>
            ))}
            {item.sports?.length > 2 && (
              <Text style={[styles.sportTag, { color: colors.primary, backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
                +{item.sports.length - 2}
              </Text>
            )}
          </View>

          <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
            {item.memberCount || 0} members
          </Text>
        </View>

        {!item.isMember && (
          <View style={styles.teamActions}>
            {item.hasPendingRequest ? (
              <View style={[styles.pendingButton, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7' }]}>
                <Ionicons name="time" size={16} color="#f59e0b" />
                <Text style={styles.pendingButtonText}>Request Pending</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinButton, { backgroundColor: colors.primary }]}
                onPress={() => handleJoinTeam(item)}
                data-testid={`button-join-team-${item.id}`}
              >
                <Ionicons name={requiresApproval ? "paper-plane" : "add-circle"} size={18} color={colors.buttonText} />
                <Text style={styles.joinButtonText}>
                  {requiresApproval ? 'Request to Join' : 'Join Team'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEventSearch = () => (
    <>
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.searchTitleRow}>
          <Ionicons name="flame" size={24} color="#ef4444" />
          <Text style={[styles.searchTitle, { color: colors.text }]}>Find Active Events</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Discover events looking for players near you</Text>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Postcode *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            placeholder="e.g. SW1A 1AA"
            placeholderTextColor={colors.inputPlaceholder}
            value={postcode}
            onChangeText={setPostcode}
            autoCapitalize="characters"
            data-testid="input-postcode"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Search Radius</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowRadiusPicker(true)}
            data-testid="button-radius-picker"
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>
              {RADIUS_OPTIONS.find(r => r.value === radius)?.label || '10 miles'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Sport</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowSportPicker(true)}
            data-testid="button-sport-picker"
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{sport}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled, { backgroundColor: loading ? colors.disabled : colors.success }]}
          onPress={handleEventSearch}
          disabled={loading}
          data-testid="button-search-events"
        >
          <Ionicons name="search" size={18} color={colors.buttonText} style={{ marginRight: 8 }} />
          <Text style={styles.searchButtonText}>
            {loading ? 'Searching...' : 'Search Events'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.resultsList}
        data={results}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={renderEvent}
        ListEmptyComponent={
          hasSearched ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="flame-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No active events found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Try searching in a larger radius or different sport
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>Ready to search</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Enter your postcode to find events looking for players
              </Text>
            </View>
          )
        }
      />
    </>
  );

  const renderTeamSearch = () => (
    <>
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.searchTitleRow}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={[styles.searchTitle, { color: colors.text }]}>Find Teams</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Search for teams to join by name</Text>

        <View style={styles.teamSearchRow}>
          <View style={[styles.teamSearchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.teamSearchTextInput, { color: colors.inputText }]}
              placeholder="Search teams..."
              placeholderTextColor={colors.inputPlaceholder}
              value={teamQuery}
              onChangeText={setTeamQuery}
              onSubmitEditing={handleTeamSearch}
              returnKeyType="search"
              data-testid="input-team-search"
            />
            {teamQuery.length > 0 && (
              <TouchableOpacity onPress={() => setTeamQuery('')} data-testid="button-clear-team-search">
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.teamSearchButton, { backgroundColor: teamLoading ? colors.disabled : colors.primary }]}
            onPress={handleTeamSearch}
            disabled={teamLoading}
            data-testid="button-search-teams"
          >
            <Ionicons name="search" size={20} color={colors.buttonText} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.resultsList}
        data={teamResults}
        keyExtractor={(item) => item.id}
        renderItem={renderTeam}
        ListEmptyComponent={
          teamHasSearched ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No teams found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Try a different search term
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>Search for teams</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Enter a team name to find teams to join
              </Text>
            </View>
          )
        }
      />
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <HeaderWithNotifications title="Search" />
      
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'events' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('events')}
          data-testid="tab-search-events"
        >
          <Ionicons 
            name="flame" 
            size={18} 
            color={activeTab === 'events' ? colors.primary : colors.textSecondary} 
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'events' ? colors.primary : colors.textSecondary }
          ]}>
            Events
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'teams' && [styles.activeTab, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('teams')}
          data-testid="tab-search-teams"
        >
          <Ionicons 
            name="people" 
            size={18} 
            color={activeTab === 'teams' ? colors.primary : colors.textSecondary} 
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'teams' ? colors.primary : colors.textSecondary }
          ]}>
            Teams
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'events' ? renderEventSearch() : renderTeamSearch()}

      <Modal
        visible={showRadiusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRadiusPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Search Radius</Text>
              <TouchableOpacity onPress={() => setShowRadiusPicker(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {RADIUS_OPTIONS.map((option, index) => {
                const isSelected = radius === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}
                    onPress={() => {
                      setRadius(option.value);
                      setShowRadiusPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.primary : colors.text }, isSelected && { fontWeight: '600' }]}>
                      {option.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSportPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSportPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Sport</Text>
              <TouchableOpacity onPress={() => setShowSportPicker(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {SPORTS.map((sportOption, index) => {
                const isSelected = sport === sportOption;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}
                    onPress={() => {
                      setSport(sportOption);
                      setShowSportPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.primary : colors.text }, isSelected && { fontWeight: '600' }]}>
                      {sportOption}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1e293b',
  },
  searchButton: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  searchButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  teamSearchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  teamSearchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  teamSearchTextInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  teamSearchButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    padding: 16,
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flareIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  flareIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  flareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  distance: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  eventDetails: {
    marginBottom: 10,
  },
  eventDate: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  eventTeam: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  sportBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  sportText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  requirements: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  responseButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  responseButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  detailsButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  teamName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  teamDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberBadgeText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  approvalBadge: {
    padding: 4,
    borderRadius: 4,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  sportTag: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  teamActions: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  pendingButtonText: {
    color: '#d97706',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1e293b',
  },
});
