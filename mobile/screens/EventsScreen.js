import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, SafeAreaView } from 'react-native';
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
    <SafeAreaView style={styles.container}>
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
            
            <Text style={styles.eventTime}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            
            {item.location && (
              <Text style={styles.eventLocation}>📍 {item.location}</Text>
            )}
            
            {item.description && (
              <Text style={styles.eventDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            
            <View style={styles.eventFooter}>
              <Text style={styles.eventSport}>{item.sport}</Text>
              <View style={styles.eventInfo}>
                {item.cost && (
                  <Text style={styles.eventCost}>£{item.cost}</Text>
                )}
                {item.maxAttendees && (
                  <Text style={styles.eventCapacity}>
                    Max: {item.maxAttendees}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>
              Join a team or create an event to get started!
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateEvent')}
            >
              <Text style={styles.createButtonText}>Create Your First Event</Text>
            </TouchableOpacity>
          </View>
        }
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateEvent')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
    flexGrow: 1,
    paddingBottom: 80, // Space for FAB
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
    marginBottom: 4,
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
});
