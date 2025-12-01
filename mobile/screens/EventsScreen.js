import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, SafeAreaView, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();

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

  const isLiveEvent = (item) => {
    if (!item.startDate || !item.startTime) return false;
    
    const now = new Date();
    const startDateTime = new Date(`${item.startDate}T${item.startTime}`);
    
    // If no end time, consider it live for 2 hours after start
    let endDateTime;
    if (item.endTime) {
      const endDate = item.endDate || item.startDate;
      endDateTime = new Date(`${endDate}T${item.endTime}`);
    } else {
      endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    }
    
    return now >= startDateTime && now <= endDateTime;
  };

  const isPastEvent = (item) => {
    if (!item.startDate) return false;
    
    // Don't mark live events as past
    if (isLiveEvent(item)) return false;
    
    const now = new Date();
    
    // If event has end time, check if it's past the end time
    if (item.endTime) {
      const endDate = item.endDate || item.startDate;
      const endDateTime = new Date(`${endDate}T${item.endTime}`);
      return now > endDateTime;
    }
    
    // Otherwise check if the date is past
    const eventDate = new Date(item.startDate);
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
          const isLive = isLiveEvent(item);
          const isPast = isPastEvent(item);
          
          const cardContent = (
            <View style={[styles.eventCardInner, isLive && styles.liveEventCard, isPast && styles.pastEventCard]}>
              <View style={styles.eventHeader}>
                <Text style={[styles.eventTitle, isPast && styles.pastEventText, isLive && styles.liveEventText]}>{item.name}</Text>
                <View style={styles.dateContainer}>
                  <Text style={[styles.eventDate, isPast && styles.pastEventText, isLive && styles.liveEventText]}>{dateStr}</Text>
                  {isPast && <Text style={styles.pastBadge}>PAST</Text>}
                  {isLive && <Text style={styles.liveBadge}>LIVE</Text>}
                </View>
              </View>
              
              <Text style={[styles.eventTime, isPast && styles.pastEventText, isLive && styles.liveEventText]}>{timeStr}</Text>
              
              {item.location && (
                <View style={styles.eventDetail}>
                  <Ionicons name="location" size={14} color={isLive ? "#ffffff" : isPast ? "#94a3b8" : "#64748b"} />
                  <Text style={[styles.eventLocation, isPast && styles.pastEventText, isLive && styles.liveEventText]}>{item.location}</Text>
                </View>
              )}
              
              {item.primaryTeam && (
                <View style={styles.eventDetail}>
                  <Ionicons name="people" size={14} color={isLive ? "#ffffff" : isPast ? "#94a3b8" : "#64748b"} />
                  <Text style={[styles.eventTeam, isPast && styles.pastEventText, isLive && styles.liveEventText]}>{item.primaryTeam.name}</Text>
                </View>
              )}
              
              {item.requirements && (
                <Text style={[styles.eventDescription, isPast && styles.pastEventText, isLive && styles.liveEventText]} numberOfLines={2}>
                  {item.requirements}
                </Text>
              )}
              
              <View style={styles.eventFooter}>
                <Text style={[styles.eventSport, isPast && styles.pastEventSport, isLive && styles.liveEventSport]}>{item.sport}</Text>
                <View style={styles.eventInfo}>
                  {item.cost && parseFloat(item.cost) > 0 && (
                    <Text style={[styles.eventCost, isPast && styles.pastEventCost, isLive && styles.liveEventCost]}>£{item.cost}</Text>
                  )}
                  {item.maxParticipants && (
                    <Text style={[styles.eventCapacity, isPast && styles.pastEventText, isLive && styles.liveEventText]}>
                      Max: {item.maxParticipants}
                    </Text>
                  )}
                  {item.recurringSeriesId && (
                    <View style={styles.recurringBadge}>
                      <Ionicons name="repeat" size={14} color={isLive ? "#ffffff" : "#10b981"} />
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
          
          return (
            <TouchableOpacity
              style={styles.eventCard}
              onPress={() => navigation.navigate('EventDetails', { id: item.id })}
            >
              {isLive ? (
                <LinearGradient
                  colors={['#3b82f6', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.liveGradient}
                >
                  {cardContent}
                </LinearGradient>
              ) : (
                cardContent
              )}
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
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
  },
  eventCardInner: {
    backgroundColor: '#ffffff',
    padding: 16,
  },
  liveGradient: {
    borderRadius: 12,
  },
  liveEventCard: {
    backgroundColor: 'transparent',
  },
  liveEventText: {
    color: '#ffffff',
  },
  liveEventSport: {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  liveEventCost: {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  liveBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#ffffff',
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
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 14,
    color: '#64748b',
  },
  eventTeam: {
    fontSize: 14,
    color: '#64748b',
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
