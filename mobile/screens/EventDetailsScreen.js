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
  ActivityIndicator,
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
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentStatusLoading, setPaymentStatusLoading] = useState(false);
  const [cancellingPayment, setCancellingPayment] = useState(false);

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
        
        // Fetch payment status if event requires payment
        if (eventData.paymentRequired && eventData.maxPlayerPayment > 0) {
          fetchPaymentStatus();
        }
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

  const fetchPaymentStatus = async () => {
    try {
      setPaymentStatusLoading(true);
      const response = await apiRequest(`/api/events/${id}/payment-status`);
      if (response.ok) {
        const data = await response.json();
        setPaymentStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment status:', error);
    } finally {
      setPaymentStatusLoading(false);
    }
  };

  const handleCancelAuthorization = async () => {
    Alert.alert(
      'Cancel Payment Authorisation',
      'Are you sure you want to cancel your payment authorisation? This will also remove you from the event attendance.',
      [
        { text: 'Keep Authorisation', style: 'cancel' },
        {
          text: 'Cancel Authorisation',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingPayment(true);
              const response = await apiRequest(`/api/events/${id}/cancel-payment`, {
                method: 'POST',
              });
              
              if (response.ok) {
                Alert.alert('Success', 'Payment authorisation cancelled');
                fetchEventDetails();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'Failed to cancel authorisation');
              }
            } catch (error) {
              console.error('Cancel authorisation error:', error);
              Alert.alert('Error', 'Failed to cancel payment authorisation');
            } finally {
              setCancellingPayment(false);
            }
          },
        },
      ]
    );
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
    // Check if payment is required and user is trying to attend without authorisation
    // Venue organiser can vote without payment authorisation
    const isVenueOrganiser = event?.venueOrganiserId === user?.id;
    
    if (status === 'attending' && event?.paymentRequired && event?.maxPlayerPayment > 0 && !isVenueOrganiser) {
      // Wait for payment status to load before blocking
      if (paymentStatusLoading) {
        Alert.alert('Please Wait', 'Checking payment status...');
        return;
      }
      if (!paymentStatus?.hasAuthorization) {
        // Redirect to payment authorisation screen
        Alert.alert(
          'Payment Required',
          'This event requires payment authorisation before you can confirm attendance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Authorise Payment', 
              onPress: () => navigation.navigate('PaymentAuthorization', {
                eventId: id,
                eventName: event.name,
                maxPlayerPayment: event.maxPlayerPayment,
              })
            }
          ]
        );
        return;
      }
    }

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
                count={attendance.filter(a => a.status === 'not_attending').length || 0}
                color="#ef4444"
                textColor={colors.text}
              />
              <SummaryItem 
                label="Maybe" 
                count={attendance.filter(a => a.status === 'maybe').length || 0}
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

        {(event.paymentRequired || (event.cost && parseFloat(event.cost) > 0)) && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Payment</Text>
            
            {event.paymentRequired && event.maxPlayerPayment > 0 && (
              <View style={styles.paymentInfo}>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: colors.textSecondary }]}>Max Player Fee:</Text>
                  <Text style={[styles.paymentValue, { color: colors.text }]}>£{parseFloat(event.maxPlayerPayment).toFixed(2)}</Text>
                </View>
              </View>
            )}
            
            {paymentStatus?.hasAuthorization ? (
              <View style={styles.paymentStatusSection}>
                <View style={[styles.authorizationBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={isDark ? '#10b981' : '#047857'} />
                  <Text style={[styles.authorizationText, { color: isDark ? '#10b981' : '#047857' }]}>
                    Payment Authorised - £{parseFloat(paymentStatus.amount || 0).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cancelAuthButton, { borderColor: '#ef4444' }]}
                  onPress={handleCancelAuthorization}
                  disabled={cancellingPayment}
                  data-testid="button-cancel-authorization"
                >
                  {cancellingPayment ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                      <Text style={styles.cancelAuthText}>Cancel Authorisation</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : userAttendance?.status === 'attending' && event.paymentRequired ? (
              <TouchableOpacity 
                style={[styles.authorizeButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('PaymentAuthorization', { 
                  eventId: event.id,
                  eventName: event.name,
                  maxPlayerPayment: event.maxPlayerPayment,
                })}
                data-testid="button-authorize-payment"
              >
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.authorizeButtonText}>Authorise Payment</Text>
              </TouchableOpacity>
            ) : !event.paymentRequired && event.cost > 0 ? (
              <TouchableOpacity 
                style={[styles.paymentButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Payment', { eventId: event.id })}
              >
                <Text style={styles.paymentButtonText}>Pay £{event.cost}</Text>
              </TouchableOpacity>
            ) : null}
            
            {canManage && event.paymentRequired && (
              <TouchableOpacity 
                style={[styles.collectPaymentsButton, { backgroundColor: '#10b981' }]}
                onPress={() => navigation.navigate('PaymentCollection', { 
                  eventId: event.id,
                  eventName: event.name,
                  eventCost: event.cost || '0',
                  eventCreatorId: event.createdById,
                  maxPlayerPayment: event.maxPlayerPayment,
                  venueOrganiserId: event.venueOrganiserId,
                  finalVenueCost: event.finalVenueCost,
                })}
                data-testid="button-collect-payments"
              >
                <Ionicons name="cash" size={20} color="#fff" />
                <Text style={styles.collectPaymentsText}>Collect Payments</Text>
              </TouchableOpacity>
            )}
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
          <View style={[styles.deleteModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>Delete Recurring Event</Text>
            <Text style={[styles.deleteModalText, { color: colors.textSecondary }]}>
              This event is part of a recurring series. What would you like to delete?
            </Text>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.deleteSingleButton, { borderColor: colors.border }]}
              onPress={() => handleDelete(false)}
              disabled={deleting}
            >
              <View style={styles.deleteOptionContent}>
                <Ionicons name="calendar-outline" size={22} color={colors.error} />
                <View style={styles.deleteOptionText}>
                  <Text style={[styles.deleteOptionTitle, { color: colors.text }]}>This Event Only</Text>
                  <Text style={[styles.deleteOptionDesc, { color: colors.textSecondary }]}>
                    Only this single event will be deleted
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.deleteSeriesButton, { borderColor: colors.border }]}
              onPress={() => handleDelete(true)}
              disabled={deleting}
            >
              <View style={styles.deleteOptionContent}>
                <Ionicons name="calendar" size={22} color={colors.error} />
                <View style={styles.deleteOptionText}>
                  <Text style={[styles.deleteOptionTitle, { color: colors.text }]}>All Future Events</Text>
                  <Text style={[styles.deleteOptionDesc, { color: colors.textSecondary }]}>
                    This and all future events in the series will be deleted
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteModalCancelButton, { borderColor: colors.border }]}
              onPress={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              <Text style={[styles.deleteModalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
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
    width: '100%',
    maxWidth: 360,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  deleteModalText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 20,
  },
  deleteModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  deleteSingleButton: {
    borderTopColor: '#e2e8f0',
  },
  deleteSeriesButton: {
    borderTopColor: '#e2e8f0',
  },
  deleteOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deleteOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  deleteOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  deleteOptionDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  deleteModalCancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  paymentInfo: {
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentStatusSection: {
    gap: 12,
  },
  authorizationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  authorizationText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cancelAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  cancelAuthText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  authorizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  authorizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  collectPaymentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  collectPaymentsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});