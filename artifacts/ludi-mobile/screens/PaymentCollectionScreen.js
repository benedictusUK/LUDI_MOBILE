import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { calculateTotalAmount } from '../lib/paymentUtils';

export default function PaymentCollectionScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const { eventId, eventName, eventCost, eventCreatorId, maxPlayerPayment, venueOrganiserId, finalVenueCost } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [venueCost, setVenueCost] = useState(finalVenueCost || eventCost || '0');
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [platformCharges, setPlatformCharges] = useState([]);
  const [selectedOrganiserId, setSelectedOrganiserId] = useState(venueOrganiserId || eventCreatorId);
  const [showOrganiserPicker, setShowOrganiserPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [membersRes, attendanceRes, chargesRes] = await Promise.all([
        apiRequest(`/api/events/${eventId}/team-members`),
        apiRequest(`/api/events/${eventId}/attendance`),
        apiRequest('/api/platform-charges'),
      ]);

      if (membersRes.ok) {
        const members = await membersRes.json();
        setTeamMembers(members);
      }

      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        setAttendance(attendanceData);
        
        const attendingIds = attendanceData
          .filter(vote => vote.status === 'can_attend' || vote.status === 'attending')
          .map(vote => vote.userId);
        setSelectedAttendees(attendingIds);
      }

      if (chargesRes.ok) {
        const charges = await chargesRes.json();
        setPlatformCharges(charges);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePerPersonCost = () => {
    const baseCost = parseFloat(venueCost || '0');
    const numAttendees = selectedAttendees.filter(id => id !== selectedOrganiserId).length;
    
    if (numAttendees === 0) return 0;
    
    const baseCostPerPerson = baseCost / numAttendees;
    const { total } = calculateTotalAmount(baseCostPerPerson, platformCharges);
    return total;
  };

  const handleCollectPayment = async () => {
    if (!selectedOrganiserId) {
      Alert.alert('Error', 'Please select a venue organiser');
      return;
    }

    if (!venueCost || parseFloat(venueCost) <= 0) {
      Alert.alert('Error', 'Please enter a valid venue cost');
      return;
    }

    const chargeableAttendees = selectedAttendees.filter(id => id !== selectedOrganiserId);
    
    if (chargeableAttendees.length === 0) {
      Alert.alert('Error', 'No attendees to charge. The venue organizer pays themselves.');
      return;
    }

    try {
      setProcessing(true);

      const response = await apiRequest(`/api/events/${eventId}/collect-payment`, {
        method: 'POST',
        body: JSON.stringify({
          venueCost,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const organizerNote = data.organizerExcluded ? ' (venue organizer excluded)' : '';
        const refundNote = Number(data.totalRefundedMinor || 0) > 0
          ? `\n£${data.totalRefunded} will be refunded to players.`
          : '';
        const outstandingNote = Number(data.totalOutstandingMinor || 0) > 0
          ? `\n£${data.totalOutstanding} is still due in total across ${data.amountOwedPerPlayer.length} player${data.amountOwedPerPlayer.length === 1 ? '' : 's'}.`
          : '';
        
        Alert.alert(
          outstandingNote ? 'Available Funds Allocated' : 'Event Payments Reconciled',
          `£${data.availableFunds} is available for the organiser${organizerNote}.${refundNote}${outstandingNote}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to collect payments');
      }
    } catch (error) {
      console.error('Collect payment error:', error);
      Alert.alert('Error', 'Failed to collect payments');
    } finally {
      setProcessing(false);
    }
  };

  const toggleAttendee = (userId) => {
    if (selectedAttendees.includes(userId)) {
      setSelectedAttendees(selectedAttendees.filter(id => id !== userId));
    } else {
      setSelectedAttendees([...selectedAttendees, userId]);
    }
  };

  const getStatusText = (vote) => {
    if (vote === 'can_attend' || vote === 'attending') return 'Attending';
    if (vote === 'cant_attend') return "Can't attend";
    return 'No response';
  };

  const getStatusColor = (vote) => {
    if (vote === 'can_attend' || vote === 'attending') return '#10b981';
    if (vote === 'cant_attend') return '#ef4444';
    return colors.textSecondary;
  };

  const perPersonCost = calculatePerPersonCost();
  const chargeableAttendeeCount = selectedAttendees.filter(id => id !== selectedOrganiserId).length;
  const totalToCollect = perPersonCost * chargeableAttendeeCount;
  const upfrontAmount = parseFloat(maxPlayerPayment || '0');
  const outstandingPerPlayer = Math.max(perPersonCost - upfrontAmount, 0);
  const outstandingTotal = outstandingPerPlayer * chargeableAttendeeCount;

  const allMembersWithVotes = teamMembers.map(member => {
    const vote = attendance.find(a => a.userId === member.userId);
    return {
      ...member,
      vote: vote?.status || null,
      isAttending: vote?.status === 'can_attend' || vote?.status === 'attending',
    };
  }).sort((a, b) => {
    if (a.isAttending && !b.isAttending) return -1;
    if (!a.isAttending && b.isAttending) return 1;
    return 0;
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Collect Payments</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} data-testid="button-back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Collect Payments</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.eventName, { color: colors.text }]}>{eventName}</Text>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Venue Cost (Required) *</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Confirm the total venue cost to be split among attendees
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>£</Text>
            <TextInput
              style={[styles.costInput, { color: colors.text }]}
              value={venueCost}
              onChangeText={setVenueCost}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              data-testid="input-venue-cost"
            />
          </View>

          {parseFloat(venueCost) > 0 && selectedAttendees.length > 0 && (
            <View style={[styles.costBreakdown, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
              <Text style={[styles.breakdownTitle, { color: isDark ? '#60a5fa' : '#1d4ed8' }]}>
                Cost Breakdown Per Person
              </Text>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: isDark ? '#93c5fd' : '#3b82f6' }]}>
                  Base amount
                </Text>
                <Text style={[styles.breakdownValue, { color: isDark ? '#93c5fd' : '#3b82f6' }]}>
                  £{(parseFloat(venueCost) / Math.max(1, selectedAttendees.filter(id => id !== selectedOrganiserId).length)).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.breakdownDivider, { backgroundColor: isDark ? '#3b82f6' : '#93c5fd' }]} />
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: isDark ? '#60a5fa' : '#1d4ed8', fontWeight: '600' }]}>
                  Total per Person
                </Text>
                <Text style={[styles.breakdownValue, { color: isDark ? '#60a5fa' : '#1d4ed8', fontWeight: '600' }]} data-testid="text-per-person-cost">
                  £{perPersonCost.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.breakdownNote, { color: isDark ? '#93c5fd' : '#3b82f6' }]}>
                Total to collect: £{totalToCollect.toFixed(2)} from {selectedAttendees.filter(id => id !== selectedOrganiserId).length} attendees
              </Text>
            </View>
          )}

          {outstandingTotal > 0 && (
            <View style={[styles.costBreakdown, { backgroundColor: isDark ? '#451a03' : '#fffbeb' }]}>
              <Text style={[styles.breakdownTitle, { color: isDark ? '#fbbf24' : '#92400e' }]}>Available funds are below the final cost</Text>
              <Text style={[styles.breakdownNote, { color: isDark ? '#fcd34d' : '#b45309' }]}>
                Current funds will be allocated. £{outstandingTotal.toFixed(2)} remains due in total; approximately £{outstandingPerPlayer.toFixed(2)} per player.
              </Text>
              {allMembersWithVotes
                .filter(member => selectedAttendees.includes(member.userId) && member.userId !== selectedOrganiserId)
                .map(member => (
                  <View key={member.userId} style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: isDark ? '#fcd34d' : '#b45309' }]}>{member.user?.firstName} {member.user?.lastName}</Text>
                    <Text style={[styles.breakdownValue, { color: isDark ? '#fbbf24' : '#92400e' }]}>£{outstandingPerPlayer.toFixed(2)}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Attendees to Charge (Required) *</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Select who should be charged for this event
          </Text>

          <View style={styles.attendeeSummary}>
            <Ionicons name="people" size={20} color={colors.textSecondary} />
            <Text style={[styles.attendeeSummaryText, { color: colors.text }]}>
              Selected: {selectedAttendees.length} attendees
            </Text>
            {selectedAttendees.length > 0 && (
              <View style={[styles.perPersonBadge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
                <Text style={[styles.perPersonBadgeText, { color: isDark ? '#60a5fa' : '#1d4ed8' }]}>
                  £{perPersonCost.toFixed(2)} each
                </Text>
              </View>
            )}
          </View>

          <View style={styles.attendeeList}>
            {allMembersWithVotes.map(member => (
              <TouchableOpacity
                key={member.userId}
                style={[
                  styles.attendeeRow,
                  { 
                    backgroundColor: member.isAttending ? (isDark ? '#064e3b' : '#d1fae5') : 'transparent',
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => toggleAttendee(member.userId)}
                data-testid={`attendee-${member.userId}`}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: selectedAttendees.includes(member.userId) ? colors.primary : colors.border },
                  selectedAttendees.includes(member.userId) && { backgroundColor: colors.primary }
                ]}>
                  {selectedAttendees.includes(member.userId) && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                
                <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>
                    {member.user?.firstName?.[0] || member.user?.email?.[0] || '?'}
                  </Text>
                </View>

                <View style={styles.attendeeInfo}>
                  <View style={styles.attendeeNameRow}>
                    <Text style={[styles.attendeeName, { color: colors.text }]}>
                      {member.user?.firstName} {member.user?.lastName}
                    </Text>
                    {member.isAttending && (
                      <View style={[styles.statusBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                        <Text style={[styles.statusBadgeText, { color: isDark ? '#10b981' : '#047857' }]}>
                          Attending
                        </Text>
                      </View>
                    )}
                    {member.userId === selectedOrganiserId && (
                      <View style={[styles.statusBadge, { backgroundColor: isDark ? '#78350f' : '#fef3c7' }]}>
                        <Text style={[styles.statusBadgeText, { color: isDark ? '#f59e0b' : '#b45309' }]}>
                          Organizer
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.attendeeStatus, { color: getStatusColor(member.vote) }]}>
                    {getStatusText(member.vote)}
                  </Text>
                </View>

                {selectedAttendees.includes(member.userId) && (
                  <View style={styles.chargeAmount}>
                    <Text style={[styles.chargeAmountText, { color: member.userId === selectedOrganiserId ? '#f59e0b' : colors.text }]}>
                      {member.userId === selectedOrganiserId ? 'N/A' : `£${perPersonCost.toFixed(2)}`}
                    </Text>
                    <Text style={[styles.chargeNote, { color: colors.textSecondary }]}>
                      {member.userId === selectedOrganiserId ? 'Pays self' : 'Charge'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
          disabled={processing}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.collectButton,
            { backgroundColor: '#10b981' },
            (processing || selectedAttendees.filter(id => id !== selectedOrganiserId).length === 0) && styles.disabledButton
          ]}
          onPress={handleCollectPayment}
          disabled={processing || selectedAttendees.filter(id => id !== selectedOrganiserId).length === 0}
          data-testid="button-collect-payments"
        >
          {processing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.collectButtonText}>Collect Payments</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  eventName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    marginRight: 4,
  },
  costInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 12,
  },
  costBreakdown: {
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
  },
  breakdownValue: {
    fontSize: 13,
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 8,
  },
  breakdownNote: {
    fontSize: 12,
    marginTop: 8,
  },
  attendeeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  attendeeSummaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  perPersonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perPersonBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  attendeeList: {
    gap: 8,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  attendeeStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  chargeAmount: {
    alignItems: 'flex-end',
  },
  chargeAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chargeNote: {
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  collectButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  collectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
