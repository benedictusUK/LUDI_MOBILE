import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation} from '@react-navigation/native';

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
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('10');
  const [sport, setSport] = useState('All Sports');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  
  const { apiRequest } = useAuth();
  const navigation = useNavigation();

  const handleSearch = async () => {
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

  const onRefresh = () => {
    if (hasSearched) {
      setRefreshing(true);
      handleSearch();
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
        // Update the local state to reflect the response
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
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.flareIndicator}>
          <Text style={styles.flareIcon}>🔥</Text>
          <Text style={styles.flareText}>FLARE</Text>
        </View>
        <Text style={styles.distance}>
          {item.distance ? `${item.distance.toFixed(1)} miles` : 'Nearby'}
        </Text>
      </View>

      <Text style={styles.eventTitle}>{item.name}</Text>
      
      <View style={styles.eventDetails}>
        <Text style={styles.eventDate}>
          📅 {formatDateTime(item.startDate, item.startTime)}
        </Text>
        {item.location && (
          <Text style={styles.eventLocation}>
            📍 {item.location}
          </Text>
        )}
        <Text style={styles.eventTeam}>
          👥 {item.team?.name || 'Unknown Team'}
        </Text>
      </View>

      <View style={styles.sportBadge}>
        <Text style={styles.sportText}>{item.sport}</Text>
      </View>

      {item.requirements && (
        <Text style={styles.requirements} numberOfLines={2}>
          Requirements: {item.requirements}
        </Text>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.responseButton,
            styles.interestedButton,
            item.userResponse === 'interested' && styles.responseButtonActive
          ]}
          onPress={() => handleFlareResponse(item.id, 'interested')}
        >
          <Text style={[
            styles.responseButtonText,
            item.userResponse === 'interested' && styles.responseButtonTextActive
          ]}>
            ✓ Interested
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.responseButton,
            styles.maybeButton,
            item.userResponse === 'maybe' && styles.responseButtonActive
          ]}
          onPress={() => handleFlareResponse(item.id, 'maybe')}
        >
          <Text style={[
            styles.responseButtonText,
            item.userResponse === 'maybe' && styles.responseButtonTextActive
          ]}>
            ? Maybe
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => navigation.navigate('EventDetails', { id: item.id })}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <Text style={styles.title}>🔍 Find Active Events</Text>
        <Text style={styles.subtitle}>Discover events looking for players near you</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Postcode *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. SW1A 1AA"
            value={postcode}
            onChangeText={setPostcode}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Search Radius</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowRadiusPicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {RADIUS_OPTIONS.find(r => r.value === radius)?.label || '10 miles'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Sport</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowSportPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{sport}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={loading}
        >
          <Text style={styles.searchButtonText}>
            {loading ? '🔍 Searching...' : '🔍 Search Events'}
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
              <Text style={styles.emptyText}>No active events found</Text>
              <Text style={styles.emptySubtext}>
                Try searching in a larger radius or different sport
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Ready to search</Text>
              <Text style={styles.emptySubtext}>
                Enter your postcode to find events looking for players
              </Text>
            </View>
          )
        }
      />

      <Modal
        visible={showRadiusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRadiusPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Search Radius</Text>
              <TouchableOpacity onPress={() => setShowRadiusPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {RADIUS_OPTIONS.map((option, index) => {
                const isSelected = radius === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setRadius(option.value);
                      setShowRadiusPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sport</Text>
              <TouchableOpacity onPress={() => setShowSportPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {SPORTS.map((sportOption, index) => {
                const isSelected = sport === sportOption;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setSport(sportOption);
                      setShowSportPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                      {sportOption}
                    </Text>
                    {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
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
  pickerArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  eventDetails: {
    marginBottom: 12,
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
  interestedButton: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  maybeButton: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  responseButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  responseButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  responseButtonTextActive: {
    color: '#ffffff',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
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
  modalClose: {
    fontSize: 24,
    color: '#6b7280',
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
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1e293b',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
});