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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, user } = useAuth();
  const { colors, isDark } = useTheme();
  const { id } = route.params;
  
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchEventDetails = async () => {
    try {
      const [eventResponse, attendanceResponse] = await Promise.all([
        apiRequest(`/api/events/${id}`),
        apiRequest(`/api/events/${id}/attendance`)
      ]);

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEvent(eventData);
        
        // Check if user can manage this event
        const isEventCreator = eventData.createdById === user?.id;
        const isTeamOwner = eventData.primaryTeam?.ownerId === user?.id;
        const userMembership = eventData.primaryTeam?.members?.find(m => m.userId === user?.id);
        const isAdminOrCaptain = userMembership && ['admin', 'captain'].includes(userMembership.role);
        
        setCanManage(isEventCreator || isTeamOwner || isAdminOrCaptain);
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

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.card,
      },
      headerTintColor: colors.text,
      headerTitleStyle: {
        color: colors.text,
      },
    });
  }, [colors, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEventDetails();
  };

  const handleEdit = () => {
    navigation.navigate('EditEvent', { event });
  };

  const handleDelete = async (deleteSeriesAfter = false) => {
    setDeleting(true);
    try {
      // Only consider it a recurring event if it actually has a series ID
      const isPartOfSeries = !!event.recurringSeriesId;
      
      let endpoint = `/api/events/${id}`;
      // Only use the recurring endpoint if deleting the entire series
      if (isPartOfSeries && deleteSeriesAfter) {
        endpoint = `/api/events/${id}/recurring?deleteSeriesAfter=true`;
      }
      
      const response = await apiRequest(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowDeleteModal(false);
        Alert.alert(
          'Success',
          deleteSeriesAfter ? 'Event and remaining recurrences deleted' : 'Event deleted successfully',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      Alert.alert('Error', 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    // Only show the modal for events that are actually part of a recurring series
    const isPartOfSeries = !!event.recurringSeriesId;
    
    if (isPartOfSeries) {
      setShowDeleteModal(true);
    } else {
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(false) }
        ]
      );
    }
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Event not found</Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userAttendance = Array.isArray(attendance) ? attendance.find(a => a.userId === user?.id) : null;
  const attendeeCount = Array.isArray(attendance) ? attendance.filter(a => a.status === 'attending').length : 0;
  const reserveCount = Array.isArray(attendance) ? attendance.filter(a => a.status === 'reserve').length : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>{event.name}</Text>
            {canManage && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.primary }]} onPress={handleEdit}>
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={confirmDelete}>
                  <Ionicons name="trash-outline" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={[styles.sportBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' }]}>
            <Text style={[styles.sportText, { color: colors.primary }]}>{event.sport}</Text>
          </View>
          {!!event.recurringSeriesId && (
            <View style={[styles.recurringBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#f0fdf4' }]}>
              <Ionicons name="repeat" size={16} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={[styles.recurringText, { color: colors.success }]}>Recurring Event</Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.card }]}>
          <DetailRow icon="calendar" label="Date" value={event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Date TBD'} />
          <DetailRow icon="time" label="Time" value={event.startTime || 'Time TBD'} />
          {event.location && (
            <DetailRow icon="location" label="Location" value={event.location} />
          )}
          <DetailRow icon="people" label="Team" value={event.primaryTeam?.name || 'Unknown'} />
          {event.maxParticipants && (
            <DetailRow 
              icon="target" 
              label="Capacity" 
              value={`${attendeeCount}/${event.maxParticipants}`} 
            />
          )}
          {event.cost && parseFloat(event.cost) > 0 && (
            <DetailRow icon="cash" label="Cost" value={`£${event.cost}`} />
          )}
        </View>

        {event.requirements && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{event.requirements}</Text>
          </View>
        )}

        <View style={[styles.attendanceCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Attendance</Text>
          <View style={styles.attendanceButtons}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.attendingButton,
                userAttendance?.status === 'attending' && styles.attendanceButtonActive
              ]}
              onPress={() => handleAttendanceUpdate('attending')}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={18} 
                color={userAttendance?.status === 'attending' ? "#ffffff" : "#10b981"} 
              />
              <Text style={[
                styles.attendanceButtonText,
                userAttendance?.status === 'attending' && styles.attendanceButtonTextActive
              ]}>
                Can Attend
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
              <Ionicons 
                name="close-circle" 
                size={18} 
                color={userAttendance?.status === 'not_attending' ? "#ffffff" : "#ef4444"} 
              />
              <Text style={[
                styles.attendanceButtonText,
                userAttendance?.status === 'not_attending' && styles.attendanceButtonTextActive
              ]}>
                Can't Attend
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
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Attendance Summary</Text>
            <View style={styles.attendanceSummary}>
              <SummaryItem 
                label="Attending" 
                count={attendeeCount}
                color="#10b981"
                textColor={colors.text}
              />
              <SummaryItem 
                label="Not Attending" 
                count={attendance.attendees?.filter(a => a.status === 'not_attending').length || 0}
                color="#ef4444"
                textColor={colors.text}
              />
              <SummaryItem 
                label="Maybe" 
                count={attendance.attendees?.filter(a => a.status === 'maybe').length || 0}
                color="#f59e0b"
                textColor={colors.text}
              />
              {reserveCount > 0 && (
                <SummaryItem 
                  label="Reserves" 
                  count={reserveCount}
                  color="#6366f1"
                  textColor={colors.text}
                />
              )}
            </View>
          </View>
        )}

        {event.cost && event.cost > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Payment</Text>
            <TouchableOpacity 
              style={styles.paymentButton}
              onPress={() => navigation.navigate('Payment', { eventId: event.id })}
            >
              <Text style={styles.paymentButtonText}>Pay £{event.cost}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Delete Modal for Recurring Events */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Recurring Event</Text>
            <Text style={styles.deleteModalText}>
              This event is part of a recurring series. What would you like to delete?
            </Text>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.deleteSingleButton]}
              onPress={() => handleDelete(false)}
              disabled={deleting}
            >
              <Text style={styles.deleteModalButtonText}>
                {deleting ? 'Deleting...' : 'Delete This Event Only'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.deleteSeriesButton]}
              onPress={() => handleDelete(true)}
              disabled={deleting}
            >
              <Text style={styles.deleteModalButtonText}>
                {deleting ? 'Deleting...' : 'Delete All Remaining Events'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.cancelButton]}
              onPress={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }) {
  const { colors } = useTheme();
  const iconMap = {
    'calendar': 'calendar-outline',
    'time': 'time-outline',
    'location': 'location-outline',
    'people': 'people-outline',
    'target': 'target-outline',
    'cash': 'cash-outline',
  };
  
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
      <Ionicons name={iconMap[icon] || icon} size={18} color={colors.icon} style={styles.detailIcon} />
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function SummaryItem({ label, count, color, textColor }) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={[styles.summaryLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.summaryCount, { color: textColor }]}>{count}</Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    fontSize: 16,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  recurringText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  deleteModalButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteSingleButton: {
    backgroundColor: '#f59e0b',
  },
  deleteSeriesButton: {
    backgroundColor: '#ef4444',
  },
  deleteModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});