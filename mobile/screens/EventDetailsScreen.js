import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, user } = useAuth();
  const { id } = route.params;
  
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEventDetails = async () => {
    try {
      const [eventResponse, attendanceResponse] = await Promise.all([
        apiRequest(`/api/events/${id}`),
        apiRequest(`/api/events/${id}/attendance`)
      ]);

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEvent(eventData);
      }

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setAttendance(attendanceData);
      }
    } catch (error) {
      console.error('Failed to fetch event details:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEventDetails();
  };

  const handleAttendanceUpdate = async (status) => {
    try {
      const response = await apiRequest(`/api/events/${id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Refresh data after attendance update
        fetchEventDetails();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update attendance');
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userAttendance = attendance?.attendees?.find(a => a.userId === user?.id);
  const attendeeCount = attendance?.attendees?.filter(a => a.status === 'attending').length || 0;
  const reserveCount = attendance?.reserves?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.eventTitle}>{event.name}</Text>
          <View style={styles.sportBadge}>
            <Text style={styles.sportText}>{event.sport}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow icon="📅" label="Date" value={event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Date TBD'} />
          <DetailRow icon="🕐" label="Time" value={event.startTime || 'Time TBD'} />
          {event.location && (
            <DetailRow icon="📍" label="Location" value={event.location} />
          )}
          <DetailRow icon="👥" label="Team" value={event.primaryTeam?.name || 'Unknown'} />
          {event.maxParticipants && (
            <DetailRow 
              icon="🎯" 
              label="Capacity" 
              value={`${attendeeCount}/${event.maxParticipants}`} 
            />
          )}
          {event.cost && parseFloat(event.cost) > 0 && (
            <DetailRow icon="💰" label="Cost" value={`£${event.cost}`} />
          )}
        </View>

        {event.requirements && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.description}>{event.requirements}</Text>
          </View>
        )}

        <View style={styles.attendanceCard}>
          <Text style={styles.cardTitle}>Your Attendance</Text>
          <View style={styles.attendanceButtons}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.attendingButton,
                userAttendance?.status === 'attending' && styles.attendanceButtonActive
              ]}
              onPress={() => handleAttendanceUpdate('attending')}
            >
              <Text style={[
                styles.attendanceButtonText,
                userAttendance?.status === 'attending' && styles.attendanceButtonTextActive
              ]}>
                ✓ Can Attend
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.notAttendingButton,
                userAttendance?.status === 'not_attending' && styles.attendanceButtonActive
              ]}
              onPress={() => handleAttendanceUpdate('not_attending')}
            >
              <Text style={[
                styles.attendanceButtonText,
                userAttendance?.status === 'not_attending' && styles.attendanceButtonTextActive
              ]}>
                ✗ Can't Attend
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.maybeButton,
                userAttendance?.status === 'maybe' && styles.attendanceButtonActive
              ]}
              onPress={() => handleAttendanceUpdate('maybe')}
            >
              <Text style={[
                styles.attendanceButtonText,
                userAttendance?.status === 'maybe' && styles.attendanceButtonTextActive
              ]}>
                ? Maybe
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {attendance && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Summary</Text>
            <View style={styles.attendanceSummary}>
              <SummaryItem 
                label="Attending" 
                count={attendeeCount}
                color="#10b981"
              />
              <SummaryItem 
                label="Not Attending" 
                count={attendance.attendees?.filter(a => a.status === 'not_attending').length || 0}
                color="#ef4444"
              />
              <SummaryItem 
                label="Maybe" 
                count={attendance.attendees?.filter(a => a.status === 'maybe').length || 0}
                color="#f59e0b"
              />
              {reserveCount > 0 && (
                <SummaryItem 
                  label="Reserves" 
                  count={reserveCount}
                  color="#6366f1"
                />
              )}
            </View>
          </View>
        )}

        {event.cost && event.cost > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <TouchableOpacity 
              style={styles.paymentButton}
              onPress={() => navigation.navigate('Payment', { eventId: event.id })}
            >
              <Text style={styles.paymentButtonText}>Pay £{event.cost}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryItem({ label, count, color }) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  sportBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  sportText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
  },
  detailLabel: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  attendanceCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceButtons: {
    gap: 12,
  },
  attendanceButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  attendingButton: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  notAttendingButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  maybeButton: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  attendanceButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  attendanceButtonTextActive: {
    color: '#ffffff',
  },
  attendanceSummary: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  paymentButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});