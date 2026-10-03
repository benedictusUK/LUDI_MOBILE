import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { calculateTotalAmount } from '../lib/paymentUtils';
import PaymentPolicyFields from '../components/PaymentPolicyFields';
import CalendarPickerModal from '../components/CalendarPickerModal';
import useSelectedTeamMembers from '../hooks/useSelectedTeamMembers';
import { defaultPolicyFields, validatePolicy, buildPolicyPayload, parseLocalText, eventWindow } from '../lib/paymentPolicy';

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
  const { apiRequest, user: authUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
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
  
  // Scroll refs for time pickers
  const startHourScrollRef = React.useRef(null);
  const startMinuteScrollRef = React.useRef(null);
  const endHourScrollRef = React.useRef(null);
  const endMinuteScrollRef = React.useRef(null);
  const ITEM_HEIGHT = 44;
  
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
    venueOrganiserId: '',
    ...defaultPolicyFields,
  });

  const [platformCharges, setPlatformCharges] = useState([]);
  const [tempSecondaryTeamIds, setTempSecondaryTeamIds] = useState([]);
  const [showVenueOrganiserPicker, setShowVenueOrganiserPicker] = useState(false);

  useEffect(() => {
    fetchUserTeams();
    fetchPlatformCharges();
  }, []);

  const { members: teamMembers, loading: membersLoading, error: membersError, retry: retryMembers } = useSelectedTeamMembers(
    apiRequest, [formData.teamId, ...formData.secondaryTeamIds], authUser?.id);

  // Auto-scroll start time picker when it opens
  useEffect(() => {
    if (showStartTimePicker) {
      const [hour, minute] = formData.startTime.split(':');
      setTempTime({ hour: hour || '12', minute: minute || '00' });
      
      setTimeout(() => {
        const hourIndex = HOURS.indexOf(hour);
        const minuteIndex = MINUTES.indexOf(minute);
        
        if (startHourScrollRef.current && hourIndex >= 0) {
          startHourScrollRef.current.scrollTo({ y: hourIndex * ITEM_HEIGHT, animated: false });
        }
        if (startMinuteScrollRef.current && minuteIndex >= 0) {
          startMinuteScrollRef.current.scrollTo({ y: minuteIndex * ITEM_HEIGHT, animated: false });
        }
      }, 100);
    }
  }, [showStartTimePicker]);

  // Auto-scroll end time picker when it opens
  useEffect(() => {
    if (showEndTimePicker) {
      const [hour, minute] = formData.endTime.split(':');
      setTempTime({ hour: hour || '12', minute: minute || '00' });
      
      setTimeout(() => {
        const hourIndex = HOURS.indexOf(hour);
        const minuteIndex = MINUTES.indexOf(minute);
        
        if (endHourScrollRef.current && hourIndex >= 0) {
          endHourScrollRef.current.scrollTo({ y: hourIndex * ITEM_HEIGHT, animated: false });
        }
        if (endMinuteScrollRef.current && minuteIndex >= 0) {
          endMinuteScrollRef.current.scrollTo({ y: minuteIndex * ITEM_HEIGHT, animated: false });
        }
      }, 100);
    }
  }, [showEndTimePicker]);

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

    {
      const { start: st, end: en } = eventWindow(formData);
      const policyError = validatePolicy(formData, st, en);
      if (policyError) {
        Alert.alert('Payment Settings', policyError);
        return;
      }
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
        ...buildPolicyPayload(formData, ...Object.values(eventWindow(formData))),
        venueOrganiserId: formData.paymentRequired && formData.venueOrganiserId ? formData.venueOrganiserId : undefined,
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
        const error = await response.json().catch(() => ({}));
        console.error('[CreateEvent] Server error:', error);
        setLoading(false);
        setTimeout(() => {
          Alert.alert('Could not save event', error.details || error.message || 'Failed to create event');
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
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.icon }]}>✕</Text>
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
                  style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.selectionBackground }]}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: isSelected ? colors.selectionText : colors.text }, isSelected && { fontWeight: '600' }]}>
                    {label}
                  </Text>
                  {isSelected && <Text style={[styles.modalCheckmark, { color: colors.primary }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            {options.length === 0 && (
              <Text style={[styles.emptyState, { color: colors.textSecondary }]}>No options available</Text>
            )}
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Event</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Event Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter event name"
            placeholderTextColor={colors.inputPlaceholder}
            maxLength={100}
          />

          <Text style={[styles.label, { color: colors.text }]}>Sport *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowSportPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{getSportLabel()}</Text>
            <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Primary Team *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowTeamPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{getTeamLabel()}</Text>
            <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
          </TouchableOpacity>

          {formData.secondaryTeamIds.length > 0 && (
            <View style={styles.secondaryTeamsContainer}>
              <Text style={[styles.secondaryTeamsLabel, { color: colors.textSecondary }]}>Additional Teams</Text>
              <View style={styles.chipContainer}>
                {formData.secondaryTeamIds.map((teamId) => (
                  <View key={teamId} style={[styles.chip, { backgroundColor: colors.primaryLight, borderColor: colors.inputBorder }]}>
                    <Text style={[styles.chipText, { color: colors.selectionText }]}>{getTeamName(teamId)}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSecondaryTeam(teamId)}>
                      <Text style={[styles.chipRemove, { color: colors.selectionText }]}>✕</Text>
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
              <Text style={[styles.addMoreButtonText, { color: colors.primary }]}>+ Add more teams</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.label, { color: colors.text }]}>Gender Restriction *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{getGenderLabel()}</Text>
            <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Start Date *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => {
              const [year, month, day] = formData.startDate.split('-').map(Number);
              setTempDate({ year, month, day });
              setShowStartDatePicker(true);
            }}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{formatDateForDisplay(formData.startDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.icon} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Start Time *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => {
              const [hour, minute] = formData.startTime.split(':');
              setTempTime({ hour, minute: MINUTES.includes(minute) ? minute : '00' });
              setShowStartTimePicker(true);
            }}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{formatTimeForDisplay(formData.startTime)}</Text>
            <Ionicons name="time-outline" size={20} color={colors.icon} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>End Time</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => {
              const [hour, minute] = formData.endTime.split(':');
              setTempTime({ hour, minute: MINUTES.includes(minute) ? minute : '00' });
              setShowEndTimePicker(true);
            }}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{formatTimeForDisplay(formData.endTime)}</Text>
            <Ionicons name="time-outline" size={20} color={colors.icon} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="Enter location"
            placeholderTextColor={colors.inputPlaceholder}
          />

          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Full address"
            placeholderTextColor={colors.inputPlaceholder}
          />

          <Text style={[styles.label, { color: colors.text }]}>Postcode</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.postcode}
            onChangeText={(text) => setFormData({ ...formData, postcode: text })}
            placeholder="Enter postcode"
            placeholderTextColor={colors.inputPlaceholder}
          />

          <Text style={[styles.label, { color: colors.text }]}>Recurrence</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowRecurrencePicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>{getRecurrenceLabel()}</Text>
            <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
          </TouchableOpacity>

          {/* Days of Week Picker - shown only for Weekly recurrence */}
          {formData.recurrenceType === 'weekly' && (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Days of Week *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => setShowDaysOfWeekPicker(true)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>
                  {formData.recurrenceDaysOfWeek.length > 0 
                    ? formData.recurrenceDaysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
                    : 'Select days'}
                </Text>
                <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Recurrence End Date - shown for any recurrence pattern */}
          {formData.recurrenceType !== 'none' && (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Recurrence End Date (Optional)</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
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
                <Text style={[styles.pickerButtonText, { color: formData.recurrenceEndDate ? colors.inputText : colors.inputPlaceholder }]}>
                  {formData.recurrenceEndDate ? formatDateForDisplay(formData.recurrenceEndDate) : 'No end date (auto 5 events)'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.icon} />
              </TouchableOpacity>
              <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
                Leave empty to auto-create up to 5 future events
              </Text>
            </>
          )}

          <Text style={[styles.label, { color: colors.text }]}>Max Participants</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.maxParticipants}
            onChangeText={(text) => setFormData({ ...formData, maxParticipants: text })}
            placeholder="Leave empty for no limit"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.text }]}>Reserve Spots</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.reserveSpots}
            onChangeText={(text) => setFormData({ ...formData, reserveSpots: text })}
            placeholder="0"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.text }]}>Cost (£)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.cost}
            onChangeText={(text) => setFormData({ ...formData, cost: text })}
            placeholder="0.00"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements}
            onChangeText={(text) => setFormData({ ...formData, requirements: text })}
            placeholder="Enter event description"
            placeholderTextColor={colors.inputPlaceholder}
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
              <PaymentPolicyFields formData={formData} setFormData={setFormData} colors={colors} />

              <Text style={[styles.label, { color: colors.text }]}>Venue Organiser</Text>
              <Text style={styles.sublabel}>Person who paid for venue - can vote without payment</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => setShowVenueOrganiserPicker(true)}
                data-testid="button-venue-organiser-picker"
              >
                <Text style={[styles.pickerButtonText, { color: formData.venueOrganiserId ? colors.inputText : colors.inputPlaceholder }]}>
                  {formData.venueOrganiserId 
                    ? teamMembers.find(m => m.id === formData.venueOrganiserId)?.name || 'Select organiser'
                    : 'Select venue organiser (optional)'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.icon} />
              </TouchableOpacity>

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

      {/* Venue Organiser Picker Modal */}
      <Modal
        visible={showVenueOrganiserPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVenueOrganiserPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Venue Organiser</Text>
              <TouchableOpacity onPress={() => setShowVenueOrganiserPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.icon }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: colors.borderLight }, !formData.venueOrganiserId && { backgroundColor: colors.selectionBackground }]}
                onPress={() => {
                  setFormData({ ...formData, venueOrganiserId: '' });
                  setShowVenueOrganiserPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: !formData.venueOrganiserId ? colors.selectionText : colors.text }]}>None (no venue organiser)</Text>
                {!formData.venueOrganiserId && <Text style={[styles.modalCheckmark, { color: colors.selectionText }]}>✓</Text>}
              </TouchableOpacity>
              {teamMembers.length === 0 && (
                <Text style={[styles.emptyState, { color: colors.textSecondary }]}>No team members available</Text>
              )}
              {membersLoading && <Text style={{ padding: 16, color: colors.textSecondary }}>Loading members...</Text>}
              {membersError && (
                <TouchableOpacity onPress={retryMembers} style={{ padding: 16 }} testID="button-retry-members">
                  <Text style={{ color: colors.error || '#dc2626' }}>{membersError} Tap to retry.</Text>
                </TouchableOpacity>
              )}
              {!membersLoading && !membersError && teamMembers.length === 0 && (
                <Text style={{ padding: 16, color: colors.textSecondary }}>No members found for the selected teams.</Text>
              )}
              {teamMembers.map((member) => {
                const isSelected = formData.venueOrganiserId === member.id;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.selectionBackground }]}
                    onPress={() => {
                      setFormData({ ...formData, venueOrganiserId: member.id });
                      setShowVenueOrganiserPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.selectionText : colors.text }, isSelected && { fontWeight: '600' }]}>
                      {member.name}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheckmark, { color: colors.selectionText }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Days of Week Multi-Select Modal */}
      <Modal
        visible={showDaysOfWeekPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDaysOfWeekPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Days</Text>
              <TouchableOpacity onPress={() => setShowDaysOfWeekPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = formData.recurrenceDaysOfWeek.includes(day.value);
                
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.selectionBackground }]}
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
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.selectionText : colors.text }]}>
                      {day.label}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheckmark, { color: colors.selectionText }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]}
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
      <CalendarPickerModal
        visible={showStartDatePicker}
        title="Select Start Date"
        value={formData.startDate}
        colors={colors}
        onSelect={(ymd) => setFormData({ ...formData, startDate: ymd, endDate: ymd })}
        onClose={() => setShowStartDatePicker(false)}
      />

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
                <ScrollView ref={startHourScrollRef} style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
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
                <ScrollView ref={startMinuteScrollRef} style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
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
                <ScrollView ref={endHourScrollRef} style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
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
                <ScrollView ref={endMinuteScrollRef} style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
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
      <CalendarPickerModal
        visible={showRecurrenceEndDatePicker}
        title="Recurrence End Date"
        value={formData.recurrenceEndDate}
        minDate={formData.startDate}
        colors={colors}
        onSelect={(ymd) => setFormData({ ...formData, recurrenceEndDate: ymd })}
        onClear={() => setFormData({ ...formData, recurrenceEndDate: '' })}
        onClose={() => setShowRecurrenceEndDatePicker(false)}
      />

      <Modal
        visible={showSecondaryTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecondaryTeamPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Additional Teams</Text>
              <TouchableOpacity onPress={() => setShowSecondaryTeamPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {getAvailableSecondaryTeams().map((team) => {
                const isSelected = tempSecondaryTeamIds.includes(team.id);
                
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: colors.selectionBackground }]}
                    onPress={() => handleToggleSecondaryTeam(team.id)}
                  >
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.selectionText : colors.text }]}>
                      {team.name}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheckmark, { color: colors.selectionText }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]}
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

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    ...(Platform.OS === 'web' ? { colorScheme: isDark ? 'dark' : 'light' } : {}),
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
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.inputBackground,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.inputText,
  },
  pickerArrow: {
    fontSize: 12,
    color: colors.icon,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
  },
  optionLeft: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.disabled,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.buttonText,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: -4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  costBreakdown: {
    backgroundColor: colors.cardSecondary,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  costBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  costBreakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  costBreakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  costBreakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  costBreakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  costBreakdownTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalClose: {
    fontSize: 24,
    color: colors.icon,
  },
  modalScroll: {
    maxHeight: 400,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 14,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalOptionSelected: {
    backgroundColor: colors.selectionBackground,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  modalOptionTextSelected: {
    color: colors.selectionText,
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 18,
    color: colors.selectionText,
    fontWeight: 'bold',
  },
  secondaryTeamsContainer: {
    marginTop: 12,
  },
  secondaryTeamsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
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
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 14,
    color: colors.selectionText,
    marginRight: 6,
  },
  chipRemove: {
    fontSize: 16,
    color: colors.selectionText,
    fontWeight: 'bold',
  },
  addMoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addMoreButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalConfirmButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  // Date/Time Picker Styles
  datePickerContent: {
    backgroundColor: colors.card,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.primary,
  },
  datePickerItemText: {
    fontSize: 16,
    color: colors.inputText,
  },
  datePickerItemTextSelected: {
    color: colors.buttonText,
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
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
  },
  clearDateButton: {
    flex: 1,
    backgroundColor: colors.buttonSecondary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  clearDateButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
});
