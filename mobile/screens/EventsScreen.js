import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();

  const fetchEvents = async () => {
    try {
      const response = await apiRequest('/api/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data || []);
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
    fetchEvents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={events}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.eventCard}
          onPress={() => navigation.navigate('EventDetails', { id: item.id })}
        >
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{item.name}</Text>
            <Text style={styles.eventDate}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          </View>
          
          {item.location && (
            <Text style={styles.eventLocation}>{item.location}</Text>
          )}
          
          <View style={styles.eventFooter}>
            <Text style={styles.eventSport}>{item.sport}</Text>
            {item.maxAttendees && (
              <Text style={styles.eventCapacity}>
                Max: {item.maxAttendees}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No events found</Text>
          <Text style={styles.emptySubtext}>
            Join a team or create an event to get started!
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  eventLocation: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
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
  eventCapacity: {
    fontSize: 12,
    color: '#6b7280',
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
