import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, SafeAreaView, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();

  const fetchEvents = async (includePast = false) => {
    try {
      const queryParams = includePast ? '?includePast=true' : '';
      const response = await apiRequest(`/api/events${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        Alert.alert('Error', 'Failed to load events');
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      Alert.alert('Error', 'Unable to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents(showPastEvents);
  }, [showPastEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(showPastEvents);
  };

  const togglePastEvents = (value) => {
    setShowPastEvents(value);
    setLoading(true);
  };

  const isPastEvent = (item) => {
    if (!item.startDate) return false;
    const eventDate = new Date(item.startDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return eventDate < now;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderWithNotifications title="Events" />
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HeaderWithNotifications title="Events" />
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, !showPastEvents && styles.toggleButtonActive]}
          onPress={() => togglePastEvents(false)}
        >
          <Text style={[styles.toggleButtonText, !showPastEvents && styles.toggleButtonTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, showPastEvents && styles.toggleButtonActive]}
          onPress={() => togglePastEvents(true)}
        >
          <Text style={[styles.toggleButtonText, showPastEvents && styles.toggleButtonTextActive]}>
            Past Events
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={events}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const eventDate = item.startDate ? new Date(item.startDate) : null;
          const dateStr = eventDate ? eventDate.toLocaleDateString() : 'Date TBD';
          const timeStr = item.startTime || 'Time TBD';
          const isPast = isPastEvent(item);
          
          return (
            <TouchableOpacity
              style={[styles.eventCard, isPast && styles.pastEventCard]}
              onPress={() => navigation.navigate('EventDetails', { id: item.id })}
            >
              <View style={styles.eventHeader}>
                <Text style={[styles.eventTitle, isPast && styles.pastEventText]}>{item.name}</Text>
                <View style={styles.dateContainer}>
                  <Text style={[styles.eventDate, isPast && styles.pastEventText]}>{dateStr}</Text>
                  {isPast && <Text style={styles.pastBadge}>PAST</Text>}
                </View>
              </View>
              
              <Text style={[styles.eventTime, isPast && styles.pastEventText]}>{timeStr}</Text>
              
              {item.location && (
                <Text style={[styles.eventLocation, isPast && styles.pastEventText]}>📍 {item.location}</Text>
              )}
              
              {item.primaryTeam && (
                <Text style={[styles.eventTeam, isPast && styles.pastEventText]}>👥 {item.primaryTeam.name}</Text>
              )}
              
              {item.requirements && (
                <Text style={[styles.eventDescription, isPast && styles.pastEventText]} numberOfLines={2}>
                  {item.requirements}
                </Text>
              )}
              
              <View style={styles.eventFooter}>
                <Text style={[styles.eventSport, isPast && styles.pastEventSport]}>{item.sport}</Text>
                <View style={styles.eventInfo}>
                  {item.cost && parseFloat(item.cost) > 0 && (
                    <Text style={[styles.eventCost, isPast && styles.pastEventCost]}>£{item.cost}</Text>
                  )}
                  {item.maxParticipants && (
                    <Text style={[styles.eventCapacity, isPast && styles.pastEventText]}>
                      Max: {item.maxParticipants}
                    </Text>
                  )}
                  {item.recurringSeriesId && (
                    <View style={styles.recurringBadge}>
                      <Ionicons name="repeat" size={14} color="#10b981" />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>
              {showPastEvents ? 'No past events' : 'No upcoming events'}
            </Text>
            <Text style={styles.emptySubtext}>
              {showPastEvents 
                ? 'Your past events will appear here'
                : 'Join a team or create an event to get started!'}
            </Text>
            {!showPastEvents && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate('CreateEvent')}
              >
                <Text style={styles.createButtonText}>Create Your First Event</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      
      {/* Floating Action Button with Gradient */}
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3b82f6', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#10b981',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  list: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
    paddingBottom: 80,
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
  eventCard: {
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
  pastEventCard: {
    backgroundColor: '#f1f5f9',
    opacity: 0.85,
  },
  pastEventText: {
    color: '#94a3b8',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  pastBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  eventTeam: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventSport: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pastEventSport: {
    color: '#94a3b8',
    backgroundColor: '#e2e8f0',
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventCost: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pastEventCost: {
    color: '#94a3b8',
    backgroundColor: '#e2e8f0',
  },
  eventCapacity: {
    fontSize: 12,
    color: '#6b7280',
  },
  recurringBadge: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
});
