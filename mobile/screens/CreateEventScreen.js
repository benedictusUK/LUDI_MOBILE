import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Modal,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { calculateTotalAmount } from '../lib/paymentUtils';

// Helper functions for date/time
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return 'Select date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTimeForDisplay = (timeStr) => {
  if (!timeStr) return 'Select time';
  return timeStr;
};

const getDefaultDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getDefaultTime = () => {
  const now = new Date();
  // Round to next hour
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return `${String(nextHour.getHours()).padStart(2, '0')}:00`;
};

const getDefaultEndTime = () => {
  const now = new Date();
  // 2 hours from now, rounded
  const endTime = new Date(now);
  endTime.setHours(now.getHours() + 2, 0, 0, 0);
  return `${String(endTime.getHours()).padStart(2, '0')}:00`;
};

// Generate arrays for picker wheels
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear + i);
};

const MONTHS = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
];

const generateDays = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const SPORTS = [
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

const GENDERS = [
  { label: 'Mixed', value: 'mixed' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

const RECURRENCE_TYPES = [
  { label: 'None', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

const DAYS_OF_WEEK = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
];

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  
  // Modal states
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showSecondaryTeamPicker, setShowSecondaryTeamPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [showDaysOfWeekPicker, setShowDaysOfWeekPicker] = useState(false);
  
  // Date/Time picker modal states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);
  
  // Temporary picker values
  const [tempDate, setTempDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [tempTime, setTempTime] = useState({ hour: '12', minute: '00' });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: SPORTS[0],
    startDate: getDefaultDate(),
    startTime: getDefaultTime(),
    endDate: getDefaultDate(),
    endTime: getDefaultEndTime(),
    location: '',
    address: '',
    postcode: '',
    teamId: '',
    secondaryTeamIds: [],
    maxParticipants: '',
    reserveSpots: '',
    cost: '',
    requirements: '',
    gender: 'mixed',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    recurrenceDaysOfWeek: [],
    isPublished: true,
    paymentRequired: false,
    maxPlayerPayment: '',
    finalVenueCost: '',
  });

  const [platformCharges, setPlatformCharges] = useState([]);
  const [tempSecondaryTeamIds, setTempSecondaryTeamIds] = useState([]);

  useEffect(() => {
    fetchUserTeams();
    fetchPlatformCharges();
  }, []);

  const fetchUserTeams = async () => {
    try {
      const response = await apiRequest('/api/teams');
      if (response.ok) {
        const teamsData = await response.json();
        setTeams(teamsData);
        if (teamsData.length > 0) {
          setFormData(prev => ({ ...prev, teamId: teamsData[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchPlatformCharges = async () => {
    try {
      const response = await apiRequest('/api/platform-charges');
      if (response.ok) {
        const charges = await response.json();
        setPlatformCharges(charges);
      }
    } catch (error) {
      console.error('Failed to fetch platform charges:', error);
    }
  };

  const handleRemoveSecondaryTeam = (teamId) => {
    setFormData({
      ...formData,
      secondaryTeamIds: formData.secondaryTeamIds.filter(id => id !== teamId)
    });
  };

  const handleOpenSecondaryTeamPicker = () => {
    setTempSecondaryTeamIds([...formData.secondaryTeamIds]);
    setShowSecondaryTeamPicker(true);
  };

  const handleToggleSecondaryTeam = (teamId) => {
    if (tempSecondaryTeamIds.includes(teamId)) {
      setTempSecondaryTeamIds(tempSecondaryTeamIds.filter(id => id !== teamId));
    } else {
      setTempSecondaryTeamIds([...tempSecondaryTeamIds, teamId]);
    }
  };

  const handleConfirmSecondaryTeams = () => {
    setFormData({ ...formData, secondaryTeamIds: tempSecondaryTeamIds });
    setShowSecondaryTeamPicker(false);
  };

  const getAvailableSecondaryTeams = () => {
    return teams.filter(team => team.id !== formData.teamId);
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : '';
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Event name is required');
      return;
    }

    if (!formData.sport) {
      Alert.alert('Validation Error', 'Please select a sport');
      return;
    }

    if (!formData.startDate) {
      Alert.alert('Validation Error', 'Start date is required');
      return;
    }

    if (!formData.startTime) {
      Alert.alert('Validation Error', 'Start time is required');
      return;
    }

    if (!formData.location.trim()) {
      Alert.alert('Validation Error', 'Location is required');
      return;
    }

    if (!formData.teamId) {
      Alert.alert('Validation Error', 'Please select a team');
      return;
    }

    if (!formData.gender) {
      Alert.alert('Validation Error', 'Please select gender restriction');
      return;
    }

    if (!formData.requirements.trim()) {
      Alert.alert('Validation Error', 'Description is required');
      return;
    }

    if (formData.paymentRequired && !formData.maxPlayerPayment) {
      Alert.alert('Validation Error', 'Max player payment is required when payment is enabled');
      return;
    }

    if (formData.paymentRequired && !formData.finalVenueCost) {
      Alert.alert('Validation Error', 'Final venue cost is required when payment is enabled');
      return;
    }

    // Validate recurrence fields
    if (formData.recurrenceType !== 'none') {
      // Recurrence end date is optional - system will auto-create up to 5 events
      if (formData.recurrenceType === 'weekly' && formData.recurrenceDaysOfWeek.length === 0) {
        Alert.alert('Validation Error', 'Please select at least one day of the week for weekly recurrence');
        return;
      }
    }

    try {
      setLoading(true);
      
      const eventData = {
        name: formData.name,
        sport: formData.sport,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate || undefined,
        endTime: formData.endTime || undefined,
        location: formData.location,
        address: formData.address || '',
        postcode: formData.postcode || '',
        primaryTeamId: formData.teamId,
        secondaryTeamIds: formData.secondaryTeamIds || [],
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
        reserveSpots: formData.reserveSpots ? parseInt(formData.reserveSpots) : 0,
        cost: formData.cost || '0.00',
        requirements: formData.requirements || '',
        gender: formData.gender,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: formData.recurrenceEndDate || undefined,
        recurrenceDaysOfWeek: formData.recurrenceDaysOfWeek,
        isPublished: formData.isPublished,
        paymentRequired: formData.paymentRequired,
        maxPlayerPayment: formData.paymentRequired && formData.maxPlayerPayment ? formData.maxPlayerPayment : undefined,
        finalVenueCost: formData.paymentRequired && formData.finalVenueCost ? formData.finalVenueCost : undefined,
      };

      console.log('[CreateEvent] Sending event data:', eventData);

      const response = await apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData),
      });

      console.log('[CreateEvent] Response received:', response.status, 'ok:', response.ok);

      if (response.ok) {
        console.log('[CreateEvent] SUCCESS - event created');
        setLoading(false);
        
        // Use setTimeout to ensure the UI has settled before showing alert
        setTimeout(() => {
          console.log('[CreateEvent] Showing success alert');
          Alert.alert(
            'Success',
            'Event created successfully!',
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('[CreateEvent] Navigating back');
                  navigation.goBack();
                }
              }
            ],
            { cancelable: false }
          );
        }, 100);
        return;
      } else {
        const error = await response.json();
        console.error('[CreateEvent] Server error:', error);
        setLoading(false);
        setTimeout(() => {
          Alert.alert('Error', error.message || 'Failed to create event');
        }, 100);
      }
    } catch (error) {
      console.error('[CreateEvent] Error:', error.message, error);
      setLoading(false);
      setTimeout(() => {
        Alert.alert('Error', error.message || 'Failed to create event. Check your internet connection.');
      }, 100);
    }
  };

  const PickerModal = ({ visible, onClose, title, options, selectedValue, onSelect, valueKey = 'value', labelKey = 'label' }) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            {options.map((option, index) => {
              const value = typeof option === 'string' ? option : option[valueKey];
              const label = typeof option === 'string' ? option : option[labelKey];
              const isSelected = selectedValue === value;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {label}
                  </Text>
                  {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const getSportLabel = () => formData.sport || 'Select sport';
  const getTeamLabel = () => {
    const team = teams.find(t => t.id === formData.teamId);
    return team ? team.name : 'Select team';
  };
  const getGenderLabel = () => {
    const gender = GENDERS.find(g => g.value === formData.gender);
    return gender ? gender.label : 'Select gender';
  };
  const getRecurrenceLabel = () => {
    const recurrence = RECURRENCE_TYPES.find(r => r.value === formData.recurrenceType);
    return recurrence ? recurrence.label : 'Select recurrence';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={styles.label}>Event Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter event name"
            maxLength={100}
          />

          <Text style={styles.label}>Sport *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowSportPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getSportLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Primary Team *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTeamPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getTeamLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {formData.secondaryTeamIds.length > 0 && (
            <View style={styles.secondaryTeamsContainer}>
              <Text style={styles.secondaryTeamsLabel}>Additional Teams</Text>
              <View style={styles.chipContainer}>
                {formData.secondaryTeamIds.map((teamId) => (
                  <View key={teamId} style={styles.chip}>
                    <Text style={styles.chipText}>{getTeamName(teamId)}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSecondaryTeam(teamId)}>
                      <Text style={styles.chipRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {getAvailableSecondaryTeams().length > 0 && (
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={handleOpenSecondaryTeamPicker}
            >
              <Text style={styles.addMoreButtonText}>+ Add more teams</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Gender Restriction *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getGenderLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Start Date *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => {
              const [year, month, day] = formData.startDate.split('-').map(Number);
              setTempDate({ year, month, day });
              setShowStartDatePicker(true);
            }}
          >
            <Text style={styles.pickerButtonText}>{formatDateForDisplay(formData.startDate)}</Text>
            <Text style={styles.pickerArrow}>📅</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => {
              const [hour, minute] = formData.startTime.split(':');
              setTempTime({ hour, minute: MINUTES.includes(minute) ? minute : '00' });
              setShowStartTimePicker(true);
            }}
          >
            <Text style={styles.pickerButtonText}>{formatTimeForDisplay(formData.startTime)}</Text>
            <Text style={styles.pickerArrow}>🕐</Text>
          </TouchableOpacity>

          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => {
              const [hour, minute] = formData.endTime.split(':');
              setTempTime({ hour, minute: MINUTES.includes(minute) ? minute : '00' });
              setShowEndTimePicker(true);
            }}
          >
            <Text style={styles.pickerButtonText}>{formatTimeForDisplay(formData.endTime)}</Text>
            <Text style={styles.pickerArrow}>🕐</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="Enter location"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Full address"
          />

          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={formData.postcode}
            onChangeText={(text) => setFormData({ ...formData, postcode: text })}
            placeholder="Enter postcode"
          />

          <Text style={styles.label}>Recurrence</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowRecurrencePicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getRecurrenceLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Days of Week Picker - shown only for Weekly recurrence */}
          {formData.recurrenceType === 'weekly' && (
            <>
              <Text style={styles.label}>Days of Week *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDaysOfWeekPicker(true)}
              >
                <Text style={styles.pickerButtonText}>
                  {formData.recurrenceDaysOfWeek.length > 0 
                    ? formData.recurrenceDaysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
                    : 'Select days'}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Recurrence End Date - shown for any recurrence pattern */}
          {formData.recurrenceType !== 'none' && (
            <>
              <Text style={styles.label}>Recurrence End Date (Optional)</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  if (formData.recurrenceEndDate) {
                    const [year, month, day] = formData.recurrenceEndDate.split('-').map(Number);
                    setTempDate({ year, month, day });
                  } else {
                    // Default to 3 months from now
                    const futureDate = new Date();
                    futureDate.setMonth(futureDate.getMonth() + 3);
                    setTempDate({ 
                      year: futureDate.getFullYear(), 
                      month: futureDate.getMonth() + 1, 
                      day: futureDate.getDate() 
                    });
                  }
                  setShowRecurrenceEndDatePicker(true);
                }}
              >
                <Text style={styles.pickerButtonText}>
                  {formData.recurrenceEndDate ? formatDateForDisplay(formData.recurrenceEndDate) : 'No end date (auto 5 events)'}
                </Text>
                <Text style={styles.pickerArrow}>📅</Text>
              </TouchableOpacity>
              <Text style={styles.sublabel}>
                Leave empty to auto-create up to 5 future events
              </Text>
            </>
          )}

          <Text style={styles.label}>Max Participants</Text>
          <TextInput
            style={styles.input}
            value={formData.maxParticipants}
            onChangeText={(text) => setFormData({ ...formData, maxParticipants: text })}
            placeholder="Leave empty for no limit"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Reserve Spots</Text>
          <TextInput
            style={styles.input}
            value={formData.reserveSpots}
            onChangeText={(text) => setFormData({ ...formData, reserveSpots: text })}
            placeholder="0"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Cost (£)</Text>
          <TextInput
            style={styles.input}
            value={formData.cost}
            onChangeText={(text) => setFormData({ ...formData, cost: text })}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements}
            onChangeText={(text) => setFormData({ ...formData, requirements: text })}
            placeholder="Enter event description"
            multiline
            numberOfLines={3}
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>💳 Payment Options</Text>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionTitle}>Require Payment</Text>
              <Text style={styles.optionSubtitle}>Collect payment from attendees</Text>
            </View>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, paymentRequired: !formData.paymentRequired })}
            >
              <View style={[
                styles.toggle,
                formData.paymentRequired && styles.toggleActive
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.paymentRequired && styles.toggleThumbActive
                ]} />
              </View>
            </TouchableOpacity>
          </View>

          {formData.paymentRequired && (
            <>
              <Text style={styles.label}>Max Player Payment (£) *</Text>
              <TextInput
                style={styles.input}
                value={formData.maxPlayerPayment}
                onChangeText={(text) => setFormData({ ...formData, maxPlayerPayment: text })}
                placeholder="20.00"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Final Venue Cost (£)</Text>
              <Text style={styles.sublabel}>Actual venue cost to be covered (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.finalVenueCost}
                onChangeText={(text) => setFormData({ ...formData, finalVenueCost: text })}
                placeholder="100.00"
                keyboardType="decimal-pad"
              />

              {formData.maxPlayerPayment && parseFloat(formData.maxPlayerPayment) > 0 && (
                <View style={styles.costBreakdown}>
                  <Text style={styles.costBreakdownTitle}>Cost Breakdown per Player</Text>
                  {(() => {
                    const { breakdown, total } = calculateTotalAmount(formData.maxPlayerPayment, platformCharges);
                    return (
                      <>
                        {breakdown.map((item, index) => (
                          <View key={index} style={styles.costBreakdownRow}>
                            <Text style={styles.costBreakdownLabel}>{item.name}</Text>
                            <Text style={styles.costBreakdownValue}>£{item.amount.toFixed(2)}</Text>
                          </View>
                        ))}
                        <View style={[styles.costBreakdownRow, styles.costBreakdownTotal]}>
                          <Text style={styles.costBreakdownTotalLabel}>Total per Player</Text>
                          <Text style={styles.costBreakdownTotalValue}>£{total.toFixed(2)}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </>
          )}

          <View style={styles.sectionDivider} />

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionTitle}>Published</Text>
              <Text style={styles.optionSubtitle}>Make event visible immediately</Text>
            </View>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
            >
              <View style={[
                styles.toggle,
                formData.isPublished && styles.toggleActive
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.isPublished && styles.toggleThumbActive
                ]} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Creating Event...' : 'Create Event'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PickerModal
        visible={showSportPicker}
        onClose={() => setShowSportPicker(false)}
        title="Select Sport"
        options={SPORTS}
        selectedValue={formData.sport}
        onSelect={(value) => setFormData({ ...formData, sport: value })}
      />

      <PickerModal
        visible={showTeamPicker}
        onClose={() => setShowTeamPicker(false)}
        title="Select Team"
        options={teams}
        selectedValue={formData.teamId}
        onSelect={(value) => setFormData({ ...formData, teamId: value })}
        valueKey="id"
        labelKey="name"
      />

      <PickerModal
        visible={showGenderPicker}
        onClose={() => setShowGenderPicker(false)}
        title="Gender Restriction"
        options={GENDERS}
        selectedValue={formData.gender}
        onSelect={(value) => setFormData({ ...formData, gender: value })}
      />

      <PickerModal
        visible={showRecurrencePicker}
        onClose={() => setShowRecurrencePicker(false)}
        title="Recurrence"
        options={RECURRENCE_TYPES}
        selectedValue={formData.recurrenceType}
        onSelect={(value) => setFormData({ ...formData, recurrenceType: value })}
      />

      {/* Days of Week Multi-Select Modal */}
      <Modal
        visible={showDaysOfWeekPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDaysOfWeekPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Days</Text>
              <TouchableOpacity onPress={() => setShowDaysOfWeekPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = formData.recurrenceDaysOfWeek.includes(day.value);
                
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setFormData({
                          ...formData,
                          recurrenceDaysOfWeek: formData.recurrenceDaysOfWeek.filter(d => d !== day.value)
                        });
                      } else {
                        setFormData({
                          ...formData,
                          recurrenceDaysOfWeek: [...formData.recurrenceDaysOfWeek, day.value]
                        });
                      }
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                      {day.label}
                    </Text>
                    {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => setShowDaysOfWeekPicker(false)}
              >
                <Text style={styles.modalConfirmButtonText}>
                  Done ({formData.recurrenceDaysOfWeek.length} selected)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Start Date</Text>
              <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerRow}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Year</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {generateYears().map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.datePickerItem, tempDate.year === year && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, year })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.year === year && styles.datePickerItemTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Month</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {MONTHS.map((month) => (
                    <TouchableOpacity
                      key={month.value}
                      style={[styles.datePickerItem, tempDate.month === month.value && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, month: month.value, day: Math.min(tempDate.day, generateDays(tempDate.year, month.value).length) })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.month === month.value && styles.datePickerItemTextSelected]}>
                        {month.label.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Day</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {generateDays(tempDate.year, tempDate.month).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.datePickerItem, tempDate.day === day && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, day })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.day === day && styles.datePickerItemTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  const dateStr = `${tempDate.year}-${String(tempDate.month).padStart(2, '0')}-${String(tempDate.day).padStart(2, '0')}`;
                  setFormData({ ...formData, startDate: dateStr, endDate: dateStr });
                  setShowStartDatePicker(false);
                }}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker Modal */}
      <Modal
        visible={showStartTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStartTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Start Time</Text>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerRow}>
              <View style={styles.timePickerColumn}>
                <Text style={styles.datePickerLabel}>Hour</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {HOURS.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.datePickerItem, tempTime.hour === hour && styles.datePickerItemSelected]}
                      onPress={() => setTempTime({ ...tempTime, hour })}
                    >
                      <Text style={[styles.datePickerItemText, tempTime.hour === hour && styles.datePickerItemTextSelected]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.timePickerColumn}>
                <Text style={styles.datePickerLabel}>Minute</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {MINUTES.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.datePickerItem, tempTime.minute === minute && styles.datePickerItemSelected]}
                      onPress={() => setTempTime({ ...tempTime, minute })}
                    >
                      <Text style={[styles.datePickerItemText, tempTime.minute === minute && styles.datePickerItemTextSelected]}>
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  const timeStr = `${tempTime.hour}:${tempTime.minute}`;
                  setFormData({ ...formData, startTime: timeStr });
                  setShowStartTimePicker(false);
                }}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        visible={showEndTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select End Time</Text>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerRow}>
              <View style={styles.timePickerColumn}>
                <Text style={styles.datePickerLabel}>Hour</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {HOURS.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.datePickerItem, tempTime.hour === hour && styles.datePickerItemSelected]}
                      onPress={() => setTempTime({ ...tempTime, hour })}
                    >
                      <Text style={[styles.datePickerItemText, tempTime.hour === hour && styles.datePickerItemTextSelected]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.timePickerColumn}>
                <Text style={styles.datePickerLabel}>Minute</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {MINUTES.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.datePickerItem, tempTime.minute === minute && styles.datePickerItemSelected]}
                      onPress={() => setTempTime({ ...tempTime, minute })}
                    >
                      <Text style={[styles.datePickerItemText, tempTime.minute === minute && styles.datePickerItemTextSelected]}>
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  const timeStr = `${tempTime.hour}:${tempTime.minute}`;
                  setFormData({ ...formData, endTime: timeStr });
                  setShowEndTimePicker(false);
                }}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Recurrence End Date Picker Modal */}
      <Modal
        visible={showRecurrenceEndDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecurrenceEndDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recurrence End Date</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceEndDatePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerRow}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Year</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {generateYears().map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.datePickerItem, tempDate.year === year && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, year })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.year === year && styles.datePickerItemTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Month</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {MONTHS.map((month) => (
                    <TouchableOpacity
                      key={month.value}
                      style={[styles.datePickerItem, tempDate.month === month.value && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, month: month.value, day: Math.min(tempDate.day, generateDays(tempDate.year, month.value).length) })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.month === month.value && styles.datePickerItemTextSelected]}>
                        {month.label.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Day</Text>
                <ScrollView style={styles.datePickerScroll}>
                  {generateDays(tempDate.year, tempDate.month).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.datePickerItem, tempDate.day === day && styles.datePickerItemSelected]}
                      onPress={() => setTempDate({ ...tempDate, day })}
                    >
                      <Text style={[styles.datePickerItemText, tempDate.day === day && styles.datePickerItemTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.datePickerButtons}>
              <TouchableOpacity
                style={styles.clearDateButton}
                onPress={() => {
                  setFormData({ ...formData, recurrenceEndDate: '' });
                  setShowRecurrenceEndDatePicker(false);
                }}
              >
                <Text style={styles.clearDateButtonText}>Clear (No End Date)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  const dateStr = `${tempDate.year}-${String(tempDate.month).padStart(2, '0')}-${String(tempDate.day).padStart(2, '0')}`;
                  setFormData({ ...formData, recurrenceEndDate: dateStr });
                  setShowRecurrenceEndDatePicker(false);
                }}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSecondaryTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecondaryTeamPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Additional Teams</Text>
              <TouchableOpacity onPress={() => setShowSecondaryTeamPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {getAvailableSecondaryTeams().map((team) => {
                const isSelected = tempSecondaryTeamIds.includes(team.id);
                
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => handleToggleSecondaryTeam(team.id)}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                      {team.name}
                    </Text>
                    {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmSecondaryTeams}
              >
                <Text style={styles.modalConfirmButtonText}>
                  Confirm ({tempSecondaryTeamIds.length} selected)
                </Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 16,
  },
  optionLeft: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    marginTop: -4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  costBreakdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  costBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  costBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  costBreakdownLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  costBreakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  costBreakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginTop: 8,
    paddingTop: 12,
  },
  costBreakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  costBreakdownTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
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
  secondaryTeamsContainer: {
    marginTop: 12,
  },
  secondaryTeamsLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 14,
    color: '#1e40af',
    marginRight: 6,
  },
  chipRemove: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  addMoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addMoreButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalConfirmButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Date/Time Picker Styles
  datePickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  datePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  datePickerScroll: {
    height: 200,
  },
  datePickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    minWidth: 60,
    alignItems: 'center',
  },
  datePickerItemSelected: {
    backgroundColor: '#3b82f6',
  },
  datePickerItemText: {
    fontSize: 16,
    color: '#1e293b',
  },
  datePickerItemTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 32,
  },
  timePickerColumn: {
    alignItems: 'center',
  },
  datePickerButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  clearDateButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  clearDateButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
