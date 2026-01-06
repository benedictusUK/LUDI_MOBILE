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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return 'Select date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTimeForDisplay = (timeStr) => {
  if (!timeStr) return 'Select time';
  return timeStr;
};

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
  "Team Social", "Badminton", "Basketball", "Boxing", "Cricket", "Cycling",
  "Fitness Training", "Football", "Golf", "Hiking", "Hockey", "Martial Arts",
  "Other", "Paddle", "Rugby", "Running", "Squash", "Swimming", "Table Tennis",
  "Tennis", "Volleyball", "Walking", "Wild Camping", "Yoga",
];

const GENDERS = [
  { label: 'Mixed', value: 'mixed' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

export default function EditEventScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { event: initialEvent } = route.params;
  const { apiRequest } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  
  // Modal states
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showRecurringScopeModal, setShowRecurringScopeModal] = useState(false);
  
  // Date/Time picker modal states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // Check if this is a recurring event
  const isRecurringEvent = !!initialEvent?.recurringSeriesId;
  
  // Temporary picker values
  const [tempDate, setTempDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [tempTime, setTempTime] = useState({ hour: '12', minute: '00' });
  
  const [formData, setFormData] = useState({
    name: initialEvent?.name || '',
    description: initialEvent?.description || '',
    sport: initialEvent?.sport || SPORTS[0],
    startDate: initialEvent?.startDate || '',
    startTime: initialEvent?.startTime || '',
    endDate: initialEvent?.endDate || '',
    endTime: initialEvent?.endTime || '',
    location: initialEvent?.location || '',
    address: initialEvent?.address || '',
    postcode: initialEvent?.postcode || '',
    teamId: initialEvent?.primaryTeamId || '',
    secondaryTeamIds: initialEvent?.secondaryTeamIds || [],
    maxParticipants: initialEvent?.maxParticipants?.toString() || '',
    reserveSpots: initialEvent?.reserveSpots?.toString() || '',
    cost: initialEvent?.cost || '',
    requirements: initialEvent?.requirements || '',
    gender: initialEvent?.gender || 'mixed',
    paymentRequired: initialEvent?.paymentRequired || false,
    maxPlayerPayment: initialEvent?.maxPlayerPayment || '',
    finalVenueCost: initialEvent?.finalVenueCost || '',
    venueOrganiserId: initialEvent?.venueOrganiserId || '',
  });
  
  const [teamMembers, setTeamMembers] = useState([]);
  const [showVenueOrganiserPicker, setShowVenueOrganiserPicker] = useState(false);
  const [showSecondaryTeamPicker, setShowSecondaryTeamPicker] = useState(false);
  const [tempSecondaryTeamIds, setTempSecondaryTeamIds] = useState([]);

  useEffect(() => {
    fetchUserTeams();
  }, []);

  useEffect(() => {
    // Fetch members from all published teams for this event
    if (initialEvent?.id) {
      fetchEventTeamMembers(initialEvent.id);
    }
  }, [initialEvent?.id]);

  const fetchEventTeamMembers = async (eventId) => {
    try {
      const response = await apiRequest(`/api/events/${eventId}/team-members`);
      if (response.ok) {
        const members = await response.json();
        console.log('[EditEvent] Fetched team members:', members.length, members);
        setTeamMembers(members.map(m => ({
          id: m.userId,
          name: m.user?.firstName && m.user?.lastName 
            ? `${m.user.firstName} ${m.user.lastName}` 
            : m.user?.username || 'Unknown',
          username: m.user?.username || '',
        })));
      }
    } catch (error) {
      console.error('Failed to fetch event team members:', error);
    }
  };

  const fetchUserTeams = async () => {
    try {
      const response = await apiRequest('/api/teams');
      if (response.ok) {
        const teamsData = await response.json();
        setTeams(teamsData);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  // Secondary team helper functions
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  };

  const getAvailableSecondaryTeams = () => {
    return teams.filter(t => t.id !== formData.teamId && !formData.secondaryTeamIds.includes(t.id));
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

  const handleConfirmSecondaryTeams = () => {
    setFormData({ ...formData, secondaryTeamIds: tempSecondaryTeamIds });
    setShowSecondaryTeamPicker(false);
  };

  const toggleSecondaryTeam = (teamId) => {
    if (tempSecondaryTeamIds.includes(teamId)) {
      setTempSecondaryTeamIds(tempSecondaryTeamIds.filter(id => id !== teamId));
    } else {
      setTempSecondaryTeamIds([...tempSecondaryTeamIds, teamId]);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Event name is required');
      return false;
    }

    if (!formData.sport) {
      Alert.alert('Validation Error', 'Please select a sport');
      return false;
    }

    if (!formData.startDate) {
      Alert.alert('Validation Error', 'Start date is required');
      return false;
    }

    if (!formData.startTime) {
      Alert.alert('Validation Error', 'Start time is required');
      return false;
    }

    if (!formData.location.trim()) {
      Alert.alert('Validation Error', 'Location is required');
      return false;
    }

    if (!formData.teamId) {
      Alert.alert('Validation Error', 'Please select a team');
      return false;
    }

    return true;
  };

  const saveEventWithScope = async (scope = 'single') => {
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
        // Defensive filter: ensure secondaryTeamIds never contains primary team
        secondaryTeamIds: (formData.secondaryTeamIds || []).filter(id => id !== formData.teamId),
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
        reserveSpots: formData.reserveSpots ? parseInt(formData.reserveSpots) : 0,
        cost: formData.cost || '0.00',
        requirements: formData.requirements || '',
        gender: formData.gender,
        paymentRequired: formData.paymentRequired,
        maxPlayerPayment: formData.paymentRequired && formData.maxPlayerPayment ? formData.maxPlayerPayment : undefined,
        finalVenueCost: formData.paymentRequired && formData.finalVenueCost ? formData.finalVenueCost : undefined,
        venueOrganiserId: formData.paymentRequired && formData.venueOrganiserId ? formData.venueOrganiserId : undefined,
      };

      console.log('[EditEvent] Sending update with scope:', scope, eventData);

      // Use recurring endpoint for recurring events, otherwise use regular endpoint
      const endpoint = isRecurringEvent 
        ? `/api/events/${initialEvent.id}/recurring?scope=${scope}`
        : `/api/events/${initialEvent.id}`;

      const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(eventData),
      });

      console.log('[EditEvent] Response received:', response.status, 'ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('[EditEvent] SUCCESS - showing alert');
        setLoading(false);
        
        const successMessage = isRecurringEvent && scope === 'future'
          ? `${result.updatedCount || 'All future'} events updated successfully!`
          : 'Event updated successfully!';
        
        Alert.alert('Success', successMessage, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      } else {
        const error = await response.json();
        console.error('[EditEvent] Server error:', error);
        Alert.alert('Error', error.message || 'Failed to update event');
      }
    } catch (error) {
      console.error('[EditEvent] Error:', error.message, error);
      Alert.alert('Error', error.message || 'Failed to update event. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // If this is a recurring event, show scope selection modal
    if (isRecurringEvent) {
      setShowRecurringScopeModal(true);
      return;
    }

    // For non-recurring events, save directly
    await saveEventWithScope('single');
  };

  const PickerModal = ({ visible, onClose, title, options, selectedValue, onSelect, valueKey = 'value', labelKey = 'label' }) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
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
                  <Text style={[styles.modalOptionText, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '600' }]}>
                    {label}
                  </Text>
                  {isSelected && <Text style={[styles.modalCheckmark, { color: colors.primary }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const DatePickerModal = ({ visible, onClose, title, onConfirm, initialDate }) => {
    const [localDate, setLocalDate] = useState(tempDate);
    const dayScrollRef = React.useRef(null);
    const monthScrollRef = React.useRef(null);
    const yearScrollRef = React.useRef(null);
    const ITEM_HEIGHT = 40;
    
    useEffect(() => {
      if (visible && initialDate) {
        const date = new Date(initialDate);
        const selectedDate = {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        };
        setLocalDate(selectedDate);
        
        setTimeout(() => {
          const dayIndex = selectedDate.day - 1;
          const monthIndex = selectedDate.month - 1;
          const yearIndex = generateYears().indexOf(selectedDate.year);
          
          if (dayScrollRef.current && dayIndex >= 0) {
            dayScrollRef.current.scrollTo({ y: dayIndex * ITEM_HEIGHT, animated: false });
          }
          if (monthScrollRef.current && monthIndex >= 0) {
            monthScrollRef.current.scrollTo({ y: monthIndex * ITEM_HEIGHT, animated: false });
          }
          if (yearScrollRef.current && yearIndex >= 0) {
            yearScrollRef.current.scrollTo({ y: yearIndex * ITEM_HEIGHT, animated: false });
          }
        }, 100);
      } else if (visible) {
        const now = new Date();
        const selectedDate = {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate()
        };
        setLocalDate(selectedDate);
        
        setTimeout(() => {
          const dayIndex = selectedDate.day - 1;
          const monthIndex = selectedDate.month - 1;
          const yearIndex = generateYears().indexOf(selectedDate.year);
          
          if (dayScrollRef.current && dayIndex >= 0) {
            dayScrollRef.current.scrollTo({ y: dayIndex * ITEM_HEIGHT, animated: false });
          }
          if (monthScrollRef.current && monthIndex >= 0) {
            monthScrollRef.current.scrollTo({ y: monthIndex * ITEM_HEIGHT, animated: false });
          }
          if (yearScrollRef.current && yearIndex >= 0) {
            yearScrollRef.current.scrollTo({ y: yearIndex * ITEM_HEIGHT, animated: false });
          }
        }, 100);
      }
    }, [visible, initialDate]);

    const years = generateYears();
    const days = generateDays(localDate.year, localDate.month);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Day</Text>
                <ScrollView ref={dayScrollRef} style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {days.map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.pickerItem, localDate.day === day && { backgroundColor: colors.selectionBackground }]}
                      onPress={() => setLocalDate(prev => ({ ...prev, day }))}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.text }, localDate.day === day && { color: colors.primary, fontWeight: '600' }]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Month</Text>
                <ScrollView ref={monthScrollRef} style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {MONTHS.map(month => (
                    <TouchableOpacity
                      key={month.value}
                      style={[styles.pickerItem, localDate.month === month.value && { backgroundColor: colors.selectionBackground }]}
                      onPress={() => setLocalDate(prev => ({ ...prev, month: month.value, day: Math.min(prev.day, generateDays(prev.year, month.value).length) }))}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.text }, localDate.month === month.value && { color: colors.primary, fontWeight: '600' }]}>
                        {month.label.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Year</Text>
                <ScrollView ref={yearScrollRef} style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {years.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.pickerItem, localDate.year === year && { backgroundColor: colors.selectionBackground }]}
                      onPress={() => setLocalDate(prev => ({ ...prev, year }))}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.text }, localDate.year === year && { color: colors.primary, fontWeight: '600' }]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                const dateStr = `${localDate.year}-${String(localDate.month).padStart(2, '0')}-${String(localDate.day).padStart(2, '0')}`;
                onConfirm(dateStr);
                onClose();
              }}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const TimePickerModal = ({ visible, onClose, title, onConfirm, initialTime }) => {
    const [localTime, setLocalTime] = useState({ hour: '12', minute: '00' });
    const hourScrollRef = React.useRef(null);
    const minuteScrollRef = React.useRef(null);
    const ITEM_HEIGHT = 40;
    
    useEffect(() => {
      if (visible && initialTime) {
        const [hour, minute] = initialTime.split(':');
        const selectedHour = hour || '12';
        const selectedMinute = minute || '00';
        setLocalTime({ hour: selectedHour, minute: selectedMinute });
        
        setTimeout(() => {
          const hourIndex = HOURS.indexOf(selectedHour);
          const minuteIndex = MINUTES.indexOf(selectedMinute);
          
          if (hourScrollRef.current && hourIndex >= 0) {
            hourScrollRef.current.scrollTo({ y: hourIndex * ITEM_HEIGHT, animated: false });
          }
          if (minuteScrollRef.current && minuteIndex >= 0) {
            minuteScrollRef.current.scrollTo({ y: minuteIndex * ITEM_HEIGHT, animated: false });
          }
        }, 100);
      }
    }, [visible, initialTime]);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.timePickerModalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timePickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Hour</Text>
                <ScrollView ref={hourScrollRef} style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.pickerItem, localTime.hour === hour && { backgroundColor: colors.selectionBackground }]}
                      onPress={() => setLocalTime(prev => ({ ...prev, hour }))}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.text }, localTime.hour === hour && { color: colors.primary, fontWeight: '600' }]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Minute</Text>
                <ScrollView ref={minuteScrollRef} style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map(minute => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.pickerItem, localTime.minute === minute && { backgroundColor: colors.selectionBackground }]}
                      onPress={() => setLocalTime(prev => ({ ...prev, minute }))}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.text }, localTime.minute === minute && { color: colors.primary, fontWeight: '600' }]}>
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                const timeStr = `${localTime.hour}:${localTime.minute}`;
                onConfirm(timeStr);
                onClose();
              }}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Event</Text>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Event Name */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Event Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="e.g., Sunday Football"
            placeholderTextColor={colors.inputPlaceholder}
          />
        </View>

        {/* Sport */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Sport *</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowSportPicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>{formData.sport}</Text>
            <Text style={[styles.pickerArrow, { color: colors.textSecondary }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Team */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Primary Team *</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowTeamPicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>
              {teams.find(t => t.id === formData.teamId)?.name || 'Select team'}
            </Text>
            <Text style={[styles.pickerArrow, { color: colors.textSecondary }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Teams */}
        {formData.secondaryTeamIds.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Additional Teams</Text>
            <View style={styles.chipContainer}>
              {formData.secondaryTeamIds.map((teamId) => (
                <View key={teamId} style={[styles.chip, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>{getTeamName(teamId)}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSecondaryTeam(teamId)}>
                    <Text style={[styles.chipRemove, { color: colors.primary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {getAvailableSecondaryTeams().length > 0 && (
          <TouchableOpacity
            style={[styles.addMoreButton, { borderColor: colors.primary }]}
            onPress={handleOpenSecondaryTeamPicker}
          >
            <Text style={[styles.addMoreButtonText, { color: colors.primary }]}>+ Add more teams</Text>
          </TouchableOpacity>
        )}

        {/* Start Date */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Start Date *</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowStartDatePicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>{formatDateForDisplay(formData.startDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Start Time */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Start Time *</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowStartTimePicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>{formatTimeForDisplay(formData.startTime)}</Text>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* End Date */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowEndDatePicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>{formatDateForDisplay(formData.endDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* End Time */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>End Time</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowEndTimePicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>{formatTimeForDisplay(formData.endTime)}</Text>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="Venue name"
            placeholderTextColor={colors.inputPlaceholder}
          />
        </View>

        {/* Address */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Street address"
            placeholderTextColor={colors.inputPlaceholder}
          />
        </View>

        {/* Postcode */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Postcode</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.postcode}
            onChangeText={(text) => setFormData({ ...formData, postcode: text })}
            placeholder="e.g., SW1A 1AA"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="characters"
          />
        </View>

        {/* Gender */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
          <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowGenderPicker(true)}>
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>
              {GENDERS.find(g => g.value === formData.gender)?.label || 'Select'}
            </Text>
            <Text style={[styles.pickerArrow, { color: colors.textSecondary }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Max Participants */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Max Participants</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.maxParticipants}
            onChangeText={(text) => setFormData({ ...formData, maxParticipants: text })}
            placeholder="e.g., 10"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="numeric"
          />
        </View>

        {/* Reserve Spots */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Reserve Spots</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.reserveSpots}
            onChangeText={(text) => setFormData({ ...formData, reserveSpots: text })}
            placeholder="e.g., 2"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="numeric"
          />
        </View>

        {/* Cost */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Cost (£)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.cost}
            onChangeText={(text) => setFormData({ ...formData, cost: text })}
            placeholder="e.g., 10.00"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={formData.requirements}
            onChangeText={(text) => setFormData({ ...formData, requirements: text })}
            placeholder="Event details, requirements, what to bring, etc."
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Payment Required Toggle */}
        <View style={styles.formGroup}>
          <TouchableOpacity 
            style={styles.toggleRow}
            onPress={() => setFormData({ ...formData, paymentRequired: !formData.paymentRequired })}
          >
            <Text style={[styles.label, { color: colors.text }]}>Payment Required</Text>
            <View style={[styles.toggle, { backgroundColor: colors.border }, formData.paymentRequired && styles.toggleActive]}>
              <View style={[styles.toggleKnob, formData.paymentRequired && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {formData.paymentRequired && (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Max Player Payment (£) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={formData.maxPlayerPayment}
                onChangeText={(text) => setFormData({ ...formData, maxPlayerPayment: text })}
                placeholder="e.g., 15.00"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Final Venue Cost (£) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={formData.finalVenueCost}
                onChangeText={(text) => setFormData({ ...formData, finalVenueCost: text })}
                placeholder="e.g., 100.00"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, { color: colors.text }]}>Venue Organiser</Text>
              <Text style={[styles.sublabel, { color: colors.textSecondary }]}>Person who paid for venue - can vote without payment</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowVenueOrganiserPicker(true)}
                data-testid="button-venue-organiser-picker"
              >
                <Text style={[styles.pickerButtonText, { color: formData.venueOrganiserId ? colors.text : colors.inputPlaceholder }]}>
                  {formData.venueOrganiserId 
                    ? teamMembers.find(m => m.id === formData.venueOrganiserId)?.name || 'Select organiser'
                    : 'Select venue organiser (optional)'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modals */}
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
        options={teams.map(t => ({ value: t.id, label: t.name }))}
        selectedValue={formData.teamId}
        onSelect={(value) => setFormData({ 
          ...formData, 
          teamId: value,
          // Remove from secondary teams if selected as primary
          secondaryTeamIds: formData.secondaryTeamIds.filter(id => id !== value)
        })}
      />

      <PickerModal
        visible={showGenderPicker}
        onClose={() => setShowGenderPicker(false)}
        title="Select Gender"
        options={GENDERS}
        selectedValue={formData.gender}
        onSelect={(value) => setFormData({ ...formData, gender: value })}
      />

      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        title="Select Start Date"
        onConfirm={(date) => setFormData({ ...formData, startDate: date })}
        initialDate={formData.startDate}
      />

      <DatePickerModal
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        title="Select End Date"
        onConfirm={(date) => setFormData({ ...formData, endDate: date })}
        initialDate={formData.endDate}
      />

      <TimePickerModal
        visible={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        title="Select Start Time"
        onConfirm={(time) => setFormData({ ...formData, startTime: time })}
        initialTime={formData.startTime}
      />

      <TimePickerModal
        visible={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        title="Select End Time"
        onConfirm={(time) => setFormData({ ...formData, endTime: time })}
        initialTime={formData.endTime}
      />

      {/* Secondary Team Picker Modal */}
      <Modal
        visible={showSecondaryTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecondaryTeamPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Additional Teams</Text>
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
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }]}
                    onPress={() => toggleSecondaryTeam(team.id)}
                  >
                    <Text style={[styles.modalOptionText, { color: colors.text }]}>{team.name}</Text>
                    <View style={[styles.checkbox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleConfirmSecondaryTeams}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
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

      {/* Recurring Event Scope Modal */}
      <Modal
        visible={showRecurringScopeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecurringScopeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.scopeModalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Recurring Event</Text>
              <TouchableOpacity onPress={() => setShowRecurringScopeModal(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.scopeDescription, { color: colors.textSecondary }]}>
              This is part of a recurring event series. Would you like to apply changes to:
            </Text>
            
            <TouchableOpacity
              style={[styles.scopeOption, { borderColor: colors.border }]}
              onPress={() => {
                setShowRecurringScopeModal(false);
                saveEventWithScope('single');
              }}
            >
              <View style={styles.scopeOptionContent}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <View style={styles.scopeOptionText}>
                  <Text style={[styles.scopeOptionTitle, { color: colors.text }]}>This Event Only</Text>
                  <Text style={[styles.scopeOptionDesc, { color: colors.textSecondary }]}>
                    Changes will only apply to this single event
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.scopeOption, { borderColor: colors.border }]}
              onPress={() => {
                setShowRecurringScopeModal(false);
                saveEventWithScope('future');
              }}
            >
              <View style={styles.scopeOptionContent}>
                <Ionicons name="calendar" size={24} color={colors.primary} />
                <View style={styles.scopeOptionText}>
                  <Text style={[styles.scopeOptionTitle, { color: colors.text }]}>All Future Events</Text>
                  <Text style={[styles.scopeOptionDesc, { color: colors.textSecondary }]}>
                    Changes will apply to this and all future events in the series
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.scopeCancelButton, { borderColor: colors.border }]}
              onPress={() => setShowRecurringScopeModal(false)}
            >
              <Text style={[styles.scopeCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  pickerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerArrow: {
    fontSize: 14,
    color: '#6b7280',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  bottomPadding: {
    height: 50,
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
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalClose: {
    fontSize: 20,
    color: '#64748b',
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalCheckmark: {
    fontSize: 18,
    color: '#3b82f6',
  },
  datePickerModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  timePickerModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    height: 200,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 200,
    gap: 40,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  pickerScroll: {
    flex: 1,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#eff6ff',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scopeModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 20,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  scopeDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    lineHeight: 20,
  },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  scopeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scopeOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  scopeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  scopeOptionDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  scopeCancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
  },
  scopeCancelText: {
    fontSize: 16,
    color: '#64748b',
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  chipRemove: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  addMoreButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addMoreButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
