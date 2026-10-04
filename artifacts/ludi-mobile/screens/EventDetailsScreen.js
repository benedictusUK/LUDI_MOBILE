import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import { effectivePolicy, isFixedPolicy, policySummary } from '../lib/paymentPolicy';

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
  const [showFlareModal, setShowFlareModal] = useState(false);
  const [sendingFlare, setSendingFlare] = useState(false);
  const [togglingFlareStatus, setTogglingFlareStatus] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState(null);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [initiatingTransfer, setInitiatingTransfer] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const [quote, setQuote] = useState(null);

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
        if (eventData.paymentRequired) {
          fetchQuote();
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

  const fetchQuote = async () => {
    try {
      const response = await apiRequest(`/api/events/${id}/payment-policy`);
      if (response.ok) setQuote(await response.json());
    } catch (error) {
      console.error('Failed to fetch payment policy:', error);
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

  const fetchPaymentSummary = async () => {
    try {
      setPaymentSummaryLoading(true);
      const response = await apiRequest(`/api/events/${id}/payment-summary`);
      if (response.ok) {
        const data = await response.json();
        setPaymentSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment summary:', error);
    } finally {
      setPaymentSummaryLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const response = await apiRequest(`/api/events/${id}/payment-audits`);
      if (response.ok) {
        const data = await response.json();
        setAuditLog(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedPlayerForPayment) return;
    
    setMarkingAsPaid(true);
    try {
      const perPlayerShare = paymentSummary?.venueCost && paymentSummary?.paidPlayers?.length + paymentSummary?.unpaidPlayers?.length > 0
        ? (parseFloat(paymentSummary.venueCost) / (paymentSummary.paidPlayers.length + paymentSummary.unpaidPlayers.length + (paymentSummary.organiserPlayed ? 1 : 0))).toFixed(2)
        : selectedPlayerForPayment.amountDue;

      const response = await apiRequest(`/api/events/${id}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedPlayerForPayment.userId,
          amount: perPlayerShare,
          notes: 'Paid externally (cash/bank transfer)',
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Player marked as paid');
        setShowMarkPaidModal(false);
        setSelectedPlayerForPayment(null);
        fetchPaymentSummary();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to mark player as paid');
      }
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      Alert.alert('Error', 'Failed to mark player as paid');
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const handleTransferFunds = async () => {
    Alert.alert(
      'Transfer Funds',
      `Transfer £${paymentSummary?.expectedPayout} to the venue organiser?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setInitiatingTransfer(true);
            try {
              const response = await apiRequest(`/api/events/${id}/reimburse`, {
                method: 'POST',
              });

              if (response.ok) {
                const data = await response.json();
                Alert.alert('Success', `£${data.amount} transferred to venue organiser`);
                fetchPaymentSummary();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'Failed to transfer funds');
              }
            } catch (error) {
              console.error('Failed to transfer funds:', error);
              Alert.alert('Error', 'Failed to transfer funds');
            } finally {
              setInitiatingTransfer(false);
            }
          },
        },
      ]
    );
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const response = await apiRequest(`/api/events/${id}/send-payment-reminders`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', data.message);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to send reminders');
      }
    } catch (error) {
      console.error('Failed to send reminders:', error);
      Alert.alert('Error', 'Failed to send payment reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const isEventInPast = () => {
    if (!event) return false;
    const eventDate = new Date(`${event.startDate}T${event.startTime || '00:00'}`);
    return eventDate < new Date();
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
                const data = await response.json().catch(() => ({}));
                Alert.alert(
                  isFixedPolicy(effectivePolicy(quote || event)) ? 'Withdrawn' : 'Success',
                  data.message || (isFixedPolicy(effectivePolicy(quote || event))
                    ? 'You have withdrawn. Your refund is being processed.'
                    : 'Payment authorisation cancelled')
                );
                fetchEventDetails();
                fetchPaymentStatus();
              } else {
                const error = await response.json().catch(() => ({}));
                Alert.alert('Cannot cancel payment', error.details || error.message || 'Failed to cancel authorisation');
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

  // Fetch payment summary for past events with payment required
  useEffect(() => {
    if (event && event.paymentRequired && isEventInPast()) {
      fetchPaymentSummary();
    }
  }, [event?.id, event?.paymentRequired]);

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
        const error = await response.json().catch(() => ({}));
        Alert.alert('Cannot delete event', error.details || error.message || 'Failed to delete event');
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

  const handleSendFlare = async () => {
    setSendingFlare(true);
    try {
      const response = await apiRequest(`/api/events/${id}/flare`, {
        method: 'POST',
        body: JSON.stringify({ sport: event.sport }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          '🚀 Flare Gun Sent!',
          `Alert sent to ${data.recipientCount} nearby players interested in ${event.sport}`,
          [{ text: 'OK', onPress: () => setShowFlareModal(false) }]
        );
        fetchEventDetails();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to send flare gun');
      }
    } catch (error) {
      console.error('Error sending flare:', error);
      Alert.alert('Error', 'Failed to send flare gun');
    } finally {
      setSendingFlare(false);
    }
  };

  const handleToggleFlareStatus = async () => {
    const newStatus = event.flareStatus === 'active' ? 'inactive' : 'active';
    setTogglingFlareStatus(true);
    try {
      const response = await apiRequest(`/api/events/${id}/flare-status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        Alert.alert(
          `Flare ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`,
          `Event is ${newStatus === 'active' ? 'now discoverable' : 'no longer discoverable'} in Flare Search`
        );
        fetchEventDetails();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update flare status');
      }
    } catch (error) {
      console.error('Error toggling flare status:', error);
      Alert.alert('Error', 'Failed to update flare status');
    } finally {
      setTogglingFlareStatus(false);
    }
  };

  const handleAttendanceUpdate = async (status) => {
    // Check if payment is required and user is trying to attend without authorisation
    // Venue organiser can vote without payment authorisation
    const isVenueOrganiser = event?.venueOrganiserId === user?.id;
    
    if (status === 'attending' && event?.paymentRequired && !isVenueOrganiser) {
      // Wait for payment status to load before blocking
      if (paymentStatusLoading) {
        Alert.alert('Please Wait', 'Checking payment status...');
        return;
      }
      if (!paymentStatus?.hasAuthorization) {
        // Redirect to payment authorisation screen
        Alert.alert(
          'Payment Required',
          event.feeConfiguration ? 'Pay the event price including fees now to confirm attendance.' : 'This event requires payment authorisation before you can confirm attendance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: event.feeConfiguration ? 'Pay Now' : 'Authorise Payment',
              onPress: () => navigation.navigate('PaymentAuthorization', {
                eventId: id,
                eventName: event.name,
                maxPlayerPayment: quote?.amountMinor != null ? quote.amountMinor / 100 : event.maxPlayerPayment,
              })
            }
          ]
        );
        return;
      }
    }

    // Check if user is currently attending with authorized payment and trying to change vote
    const currentlyAttending = userAttendance?.status === 'attending';
    const hasPaymentAuthorization = paymentStatus?.hasAuthorization;
    const changingFromAttending = currentlyAttending && (status === 'not_attending' || status === 'maybe');
    
    if (changingFromAttending && hasPaymentAuthorization && event?.paymentRequired) {
      // Show confirmation popup warning about payment release
      Alert.alert(
        'Release Payment Authorisation?',
        isFixedPolicy(effectivePolicy(quote || event))
          ? 'Withdrawing is only refunded in full before the registration deadline. After it, paid withdrawals are rejected.'
          : 'Changing your attendance will release your payment authorisation. You will need to authorise payment again if you decide to attend.',
        [
          { text: 'Keep Attending', style: 'cancel' },
          { 
            text: 'Release & Change Vote', 
            style: 'destructive',
            onPress: () => performAttendanceUpdate(status)
          }
        ]
      );
      return;
    }

    performAttendanceUpdate(status);
  };

  const performAttendanceUpdate = async (status) => {
    setUpdatingAttendance(true);
    try {
      const response = await apiRequest(`/api/events/${id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        fetchEventDetails();
        if (event?.paymentRequired) {
          fetchPaymentStatus();
          fetchQuote();
        }
        if (data?.refundStatus || (data?.message && status !== 'attending' && event?.paymentRequired)) {
          Alert.alert('Payment', data.message || `Your refund is ${String(data.refundStatus).replace(/_/g, ' ')}.`);
        }
      } else {
        const error = await response.json().catch(() => ({}));
        Alert.alert('Could not update attendance', error.details || error.message || 'Failed to update attendance');
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    } finally {
      setUpdatingAttendance(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>Loading event...</Text>
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
                <TouchableOpacity 
                  style={[styles.flareButton, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2', borderColor: '#ef4444' }]} 
                  onPress={() => setShowFlareModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Send flare for this event"
                  data-testid="button-flare-gun"
                >
                  <Ionicons name="flame" size={18} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.primary }]} onPress={handleEdit} accessibilityRole="button" accessibilityLabel="Edit event">
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Delete event">
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
          {event.paymentRequired ? (
            <DetailRow icon="cash" label={isFixedPolicy(effectivePolicy(event)) ? "Price per player" : "Maximum per player"}
              value={`£${(isFixedPolicy(effectivePolicy(event)) ? Number(event.fixedPriceMinor || 0) / 100 : Number(event.maxPlayerPayment || 0)).toFixed(2)} GBP`} />
          ) : event.cost && parseFloat(event.cost) > 0 && (
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
          {updatingAttendance ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.attendanceButtonText, { color: colors.textSecondary, marginTop: 8 }]}>Updating...</Text>
            </View>
          ) : (
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  styles.attendingButton,
                  userAttendance?.status === 'attending' && styles.attendanceButtonActive
                ]}
                onPress={() => handleAttendanceUpdate('attending')}
                disabled={updatingAttendance}
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
                disabled={updatingAttendance}
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
                disabled={updatingAttendance}
              >
                <Text style={[
                  styles.attendanceButtonText,
                  userAttendance?.status === 'maybe' && styles.attendanceButtonTextActive
                ]}>
                  ? Maybe
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
            
            {event.paymentRequired && (
              <Text style={[styles.paymentLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                {policySummary(
                  effectivePolicy(quote || event),
                  quote?.amountMinor != null ? quote.amountMinor / 100 : event.maxPlayerPayment,
                  quote?.minimumPaidParticipants ?? event.minimumPaidParticipants,
                  !!event.feeConfiguration
                )}
              </Text>
            )}
            {event.paymentRequired && quote?.canPay === false && quote?.reason ? (
              <Text style={{ color: '#b45309', marginBottom: 8 }}>{quote.reason}</Text>
            ) : null}

            {event.paymentRequired && event.maxPlayerPayment > 0 && (
              <View style={styles.paymentInfo}>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: colors.textSecondary }]}>{isFixedPolicy(effectivePolicy(quote || event)) ? 'Price (GBP):' : 'Max Player Fee (GBP):'}</Text>
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
                  maxPlayerPayment: quote?.amountMinor != null ? quote.amountMinor / 100 : event.maxPlayerPayment,
                })}
                data-testid="button-authorize-payment"
              >
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.authorizeButtonText}>{event.feeConfiguration ? 'Pay Now' : 'Authorise Payment'}</Text>
              </TouchableOpacity>
            ) : !event.paymentRequired && event.cost > 0 ? (
              <TouchableOpacity 
                style={[styles.paymentButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Payment', { eventId: event.id })}
              >
                <Text style={styles.paymentButtonText}>Pay £{event.cost}</Text>
              </TouchableOpacity>
            ) : null}
            
            {canManage && event.paymentRequired && !isFixedPolicy(effectivePolicy(quote || event)) && (
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
                <Text style={styles.collectPaymentsText}>{event.feeConfiguration ? 'Finalise cost and refunds' : 'Collect Payments'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Payment Summary for Past Events */}
        {event.paymentRequired && isEventInPast() && paymentSummary && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Payment Summary</Text>
            
            {/* Bank Balance Progress */}
            <View style={styles.bankSection}>
              <View style={styles.bankHeader}>
                <View style={styles.bankInfo}>
                  <Ionicons name="wallet" size={22} color={colors.primary} />
                  <Text style={[styles.bankLabel, { color: colors.text }]}>Bank</Text>
                </View>
                <Text style={[styles.bankAmount, { color: colors.primary }]}>
                  £{parseFloat(paymentSummary.bankTotal).toFixed(2)} / £{parseFloat(paymentSummary.venueCost).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(100, (parseFloat(paymentSummary.bankTotal) / parseFloat(paymentSummary.venueCost)) * 100)}%`,
                      backgroundColor: paymentSummary.isReadyToTransfer ? '#10b981' : colors.primary 
                    }
                  ]} 
                />
              </View>
              {paymentSummary.isReadyToTransfer && (
                <View style={[styles.readyBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={[styles.readyText, { color: '#10b981' }]}>Ready to transfer</Text>
                </View>
              )}
            </View>

            {/* Organiser Payout Info */}
            <View style={[styles.organiserSection, { borderColor: colors.border }]}>
              <View style={styles.organiserHeader}>
                <Ionicons name="person-circle" size={20} color={colors.primary} />
                <Text style={[styles.organiserLabel, { color: colors.text }]}>Venue Organiser</Text>
              </View>
              <Text style={[styles.organiserName, { color: colors.textSecondary }]}>
                {paymentSummary.organiser?.firstName} {paymentSummary.organiser?.lastName}
                {paymentSummary.organiserPlayed && ' (played)'}
              </Text>
              <Text style={[styles.payoutAmount, { color: colors.text }]}>
                Expected Payout: £{parseFloat(paymentSummary.expectedPayout).toFixed(2)}
              </Text>
              {paymentSummary.transferStatus === 'completed' && (
                <View style={[styles.transferBadge, { backgroundColor: '#d1fae5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#047857" />
                  <Text style={[styles.transferText, { color: '#047857' }]}>Transferred</Text>
                </View>
              )}
            </View>

            {/* Paid Players Section */}
            <View style={styles.paymentListSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Paid ({paymentSummary.paidPlayers?.length || 0})
              </Text>
              {paymentSummary.paidPlayers?.map((player) => (
                <View key={player.userId} style={[styles.playerRow, { borderColor: colors.border }]}>
                  <View style={styles.playerInfo}>
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    <Text style={[styles.playerName, { color: colors.text }]}>
                      {player.user?.firstName} {player.user?.lastName}
                    </Text>
                    {player.isManual && (
                      <View style={[styles.manualBadge, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7' }]}>
                        <Text style={styles.manualText}>Cash</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.playerAmount, { color: '#10b981' }]}>
                    £{parseFloat(player.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Unpaid Players Section */}
            {paymentSummary.unpaidPlayers?.length > 0 && (
              <View style={styles.paymentListSection}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
                  Outstanding ({paymentSummary.unpaidPlayers?.length || 0})
                </Text>
                {paymentSummary.unpaidPlayers?.map((player) => (
                  <View key={player.userId} style={[styles.playerRow, { borderColor: colors.border }]}>
                    <View style={styles.playerInfo}>
                      <Ionicons name="time" size={18} color="#f59e0b" />
                      <Text style={[styles.playerName, { color: colors.text }]}>
                        {player.user?.firstName} {player.user?.lastName}
                      </Text>
                    </View>
                    <View style={styles.unpaidActions}>
                      <Text style={[styles.playerAmount, { color: '#f59e0b' }]}>
                        £{parseFloat(player.amountDue).toFixed(2)}
                      </Text>
                      {canManage && (
                        <TouchableOpacity
                          style={[styles.markPaidBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }]}
                          onPress={() => {
                            setSelectedPlayerForPayment(player);
                            setShowMarkPaidModal(true);
                          }}
                        >
                          <Text style={styles.markPaidText}>Mark Paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                
                {/* Send Reminders Button */}
                {canManage && (
                  <TouchableOpacity
                    style={[styles.sendReminderButton, { backgroundColor: '#f59e0b' }]}
                    onPress={handleSendReminders}
                    disabled={sendingReminders}
                  >
                    {sendingReminders ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="notifications" size={18} color="#fff" />
                        <Text style={styles.sendReminderText}>Send Payment Reminders</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Admin Transfer Button */}
            {canManage && paymentSummary.isReadyToTransfer && paymentSummary.transferStatus !== 'completed' && (
              <TouchableOpacity
                style={[styles.transferButton, { backgroundColor: '#10b981' }]}
                onPress={handleTransferFunds}
                disabled={initiatingTransfer || !paymentSummary.organiser?.payoutsEnabled}
              >
                {initiatingTransfer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
                    <Text style={styles.transferButtonText}>
                      Transfer £{parseFloat(paymentSummary.expectedPayout).toFixed(2)} to Organiser
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Warning if organiser doesn't have payout enabled */}
            {canManage && paymentSummary.isReadyToTransfer && !paymentSummary.organiser?.payoutsEnabled && (
              <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7' }]}>
                <Ionicons name="warning" size={18} color="#f59e0b" />
                <Text style={[styles.warningText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
                  Organiser needs to set up their payment account before receiving transfers
                </Text>
              </View>
            )}

            {/* Admin Audit Log Toggle */}
            {canManage && (
              <TouchableOpacity
                style={[styles.auditToggle, { borderColor: colors.border }]}
                onPress={() => {
                  setShowAuditLog(!showAuditLog);
                  if (!showAuditLog && auditLog.length === 0) {
                    fetchAuditLog();
                  }
                }}
              >
                <View style={styles.auditToggleContent}>
                  <Ionicons name="document-text" size={18} color={colors.textSecondary} />
                  <Text style={[styles.auditToggleText, { color: colors.textSecondary }]}>
                    Payment Audit Log
                  </Text>
                </View>
                <Ionicons 
                  name={showAuditLog ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
            )}

            {/* Audit Log Details */}
            {showAuditLog && (
              <View style={styles.auditLogSection}>
                {auditLog.length === 0 ? (
                  <Text style={[styles.noAuditText, { color: colors.textSecondary }]}>
                    No payment activity recorded yet
                  </Text>
                ) : (
                  auditLog.map((entry) => (
                    <View key={entry.id} style={[styles.auditEntry, { borderColor: colors.border }]}>
                      <View style={styles.auditHeader}>
                        <Text style={[styles.auditType, { color: colors.text }]}>
                          {entry.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                        <Text style={[styles.auditDate, { color: colors.textSecondary }]}>
                          {new Date(entry.createdAt).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>
                      {entry.user && (
                        <Text style={[styles.auditUser, { color: colors.textSecondary }]}>
                          Player: {entry.user.firstName} {entry.user.lastName}
                        </Text>
                      )}
                      {entry.netAmount && (
                        <View style={styles.auditAmounts}>
                          <Text style={[styles.auditAmount, { color: colors.text }]}>
                            Net: £{parseFloat(entry.netAmount).toFixed(2)}
                          </Text>
                          {entry.ludiFee && parseFloat(entry.ludiFee) > 0 && (
                            <Text style={[styles.auditFee, { color: colors.textSecondary }]}>
                              (LUDI: £{parseFloat(entry.ludiFee).toFixed(2)}, Stripe: £{parseFloat(entry.stripeFee || 0).toFixed(2)})
                            </Text>
                          )}
                        </View>
                      )}
                      {entry.notes && (
                        <Text style={[styles.auditNotes, { color: colors.textSecondary }]}>
                          {entry.notes}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
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

      {/* Flare Gun Modal */}
      <Modal
        visible={showFlareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFlareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.flareModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.flareModalHeader}>
              <View style={styles.flareModalTitleRow}>
                <Ionicons name="flame" size={24} color="#ef4444" />
                <Text style={[styles.flareModalTitle, { color: colors.text }]}>Flare Gun</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFlareModal(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.flareStatusSection}>
              <Text style={[styles.flareSectionTitle, { color: colors.text }]}>Flare Status</Text>
              <View style={[styles.flareStatusBox, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderColor: colors.border }]}>
                <View style={styles.flareStatusInfo}>
                  <View style={[styles.flareStatusDot, { backgroundColor: event?.flareStatus === 'active' ? '#ef4444' : colors.textSecondary }]} />
                  <View style={styles.flareStatusTextContainer}>
                    <Text style={[styles.flareStatusLabel, { color: colors.text }]}>
                      Event is {event?.flareStatus === 'active' ? 'discoverable' : 'not discoverable'}
                    </Text>
                    <Text style={[styles.flareStatusDesc, { color: colors.textSecondary }]}>
                      {event?.flareStatus === 'active' 
                        ? 'Others can find this event in Flare Search'
                        : 'Event is hidden from Flare Search'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.flareToggleButtonFull,
                    { backgroundColor: event?.flareStatus === 'active' ? '#fef2f2' : colors.primary, borderColor: event?.flareStatus === 'active' ? '#ef4444' : colors.primary }
                  ]}
                  onPress={handleToggleFlareStatus}
                  disabled={togglingFlareStatus}
                >
                  {togglingFlareStatus ? (
                    <ActivityIndicator size="small" color={event?.flareStatus === 'active' ? '#ef4444' : '#ffffff'} />
                  ) : (
                    <Text style={[styles.flareToggleText, { color: event?.flareStatus === 'active' ? '#ef4444' : '#ffffff' }]}>
                      {event?.flareStatus === 'active' ? 'Deactivate' : 'Activate'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.flareSendSection}>
              <Text style={[styles.flareSectionTitle, { color: colors.text }]}>Send Flare Alert</Text>
              <Text style={[styles.flareDescription, { color: colors.textSecondary }]}>
                Notify nearby players interested in {event?.sport} who haven't joined this team yet.
              </Text>
              <TouchableOpacity
                style={[styles.flareSendButton, { backgroundColor: sendingFlare ? colors.disabled : '#ef4444' }]}
                onPress={handleSendFlare}
                disabled={sendingFlare}
              >
                {sendingFlare ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="rocket" size={20} color="#ffffff" />
                    <Text style={styles.flareSendButtonText}>Send Flare Gun</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.flareCloseButton, { borderColor: colors.border }]}
              onPress={() => setShowFlareModal(false)}
            >
              <Text style={[styles.flareCloseButtonText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mark as Paid Modal */}
      <Modal
        visible={showMarkPaidModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarkPaidModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.markPaidModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.markPaidTitle, { color: colors.text }]}>Mark as Paid</Text>
            <Text style={[styles.markPaidDescription, { color: colors.textSecondary }]}>
              Confirm that {selectedPlayerForPayment?.user?.firstName} {selectedPlayerForPayment?.user?.lastName} has paid 
              £{parseFloat(selectedPlayerForPayment?.amountDue || 0).toFixed(2)} outside of the LUDI platform (e.g., cash or bank transfer).
            </Text>
            
            <View style={styles.markPaidButtons}>
              <TouchableOpacity
                style={[styles.markPaidCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowMarkPaidModal(false);
                  setSelectedPlayerForPayment(null);
                }}
                disabled={markingAsPaid}
              >
                <Text style={[styles.markPaidCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.markPaidConfirmBtn, { backgroundColor: '#10b981' }]}
                onPress={handleMarkAsPaid}
                disabled={markingAsPaid}
              >
                {markingAsPaid ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.markPaidConfirmText}>Confirm Paid</Text>
                )}
              </TouchableOpacity>
            </View>
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
    flexShrink: 1,
    alignSelf: 'stretch',
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
    alignItems: 'flex-start',
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
    flexShrink: 1,
    flexBasis: '40%',
    marginRight: 12,
  },
  detailValue: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
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
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  flareButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flareModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  flareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  flareModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flareModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  flareStatusSection: {
    marginBottom: 24,
  },
  flareSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  flareStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  flareStatusBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  flareStatusInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  flareStatusTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  flareStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  flareStatusLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  flareStatusDesc: {
    fontSize: 13,
  },
  flareToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  flareToggleButtonFull: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  flareGunIconSmall: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  flareGunIconLarge: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  flareToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  flareSendSection: {
    marginBottom: 24,
  },
  flareDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  flareSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 10,
  },
  flareSendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  flareCloseButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  flareCloseButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Payment Summary Styles
  bankSection: {
    marginBottom: 20,
  },
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  bankAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  readyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  organiserSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 16,
  },
  organiserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  organiserLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  organiserName: {
    fontSize: 14,
    marginBottom: 4,
    marginLeft: 28,
  },
  payoutAmount: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 28,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 28,
  },
  transferText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentListSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  manualBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  manualText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
  },
  playerAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  unpaidActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markPaidBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  transferButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  auditToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    marginTop: 10,
  },
  auditToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auditToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  auditLogSection: {
    marginTop: 12,
  },
  noAuditText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  auditEntry: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  auditType: {
    fontSize: 13,
    fontWeight: '600',
  },
  auditDate: {
    fontSize: 12,
  },
  auditUser: {
    fontSize: 13,
    marginBottom: 4,
  },
  auditAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auditAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  auditFee: {
    fontSize: 12,
  },
  auditNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Mark Paid Modal Styles
  markPaidModalContent: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
  },
  markPaidTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  markPaidDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  markPaidButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  markPaidCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  markPaidCancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  markPaidConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  markPaidConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Send Reminder Button Styles
  sendReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  sendReminderText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});