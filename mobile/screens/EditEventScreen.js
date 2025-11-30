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
import { useAuth } from '../contexts/AuthContext';
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
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  
  // Modal states
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  
  // Date/Time picker modal states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
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
    maxParticipants: initialEvent?.maxParticipants?.toString() || '',
    reserveSpots: initialEvent?.reserveSpots?.toString() || '',
    cost: initialEvent?.cost || '',
    requirements: initialEvent?.requirements || '',
    gender: initialEvent?.gender || 'mixed',
    paymentRequired: initialEvent?.paymentRequired || false,
    maxPlayerPayment: initialEvent?.maxPlayerPayment || '',
    finalVenueCost: initialEvent?.finalVenueCost || '',
  });

  useEffect(() => {
    fetchUserTeams();
  }, []);

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

  const handleSubmit = async () => {
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
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
        reserveSpots: formData.reserveSpots ? parseInt(formData.reserveSpots) : 0,
        cost: formData.cost || '0.00',
        requirements: formData.requirements || '',
        gender: formData.gender,
        paymentRequired: formData.paymentRequired,
        maxPlayerPayment: formData.paymentRequired && formData.maxPlayerPayment ? formData.maxPlayerPayment : undefined,
        finalVenueCost: formData.paymentRequired && formData.finalVenueCost ? formData.finalVenueCost : undefined,
      };

      console.log('[EditEvent] Sending update:', eventData);

      const response = await apiRequest(`/api/events/${initialEvent.id}`, {
        method: 'PUT',
        body: JSON.stringify(eventData),
      });

      console.log('[EditEvent] Response received:', response.status, 'ok:', response.ok);

      if (response.ok) {
        console.log('[EditEvent] SUCCESS - showing alert');
        setLoading(false);
        Alert.alert('Success', 'Event updated successfully!', [
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

  const DatePickerModal = ({ visible, onClose, title, onConfirm, initialDate }) => {
    const [localDate, setLocalDate] = useState(tempDate);
    
    useEffect(() => {
      if (visible && initialDate) {
        const date = new Date(initialDate);
        setLocalDate({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        });
      } else if (visible) {
        const now = new Date();
        setLocalDate({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate()
        });
      }
    }, [visible, initialDate]);

    const years = generateYears();
    const days = generateDays(localDate.year, localDate.month);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {days.map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.pickerItem, localDate.day === day && styles.pickerItemSelected]}
                      onPress={() => setLocalDate(prev => ({ ...prev, day }))}
                    >
                      <Text style={[styles.pickerItemText, localDate.day === day && styles.pickerItemTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {MONTHS.map(month => (
                    <TouchableOpacity
                      key={month.value}
                      style={[styles.pickerItem, localDate.month === month.value && styles.pickerItemSelected]}
                      onPress={() => setLocalDate(prev => ({ ...prev, month: month.value, day: Math.min(prev.day, generateDays(prev.year, month.value).length) }))}
                    >
                      <Text style={[styles.pickerItemText, localDate.month === month.value && styles.pickerItemTextSelected]}>
                        {month.label.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {years.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.pickerItem, localDate.year === year && styles.pickerItemSelected]}
                      onPress={() => setLocalDate(prev => ({ ...prev, year }))}
                    >
                      <Text style={[styles.pickerItemText, localDate.year === year && styles.pickerItemTextSelected]}>
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
    
    useEffect(() => {
      if (visible && initialTime) {
        const [hour, minute] = initialTime.split(':');
        setLocalTime({ hour: hour || '12', minute: minute || '00' });
      }
    }, [visible, initialTime]);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timePickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.pickerItem, localTime.hour === hour && styles.pickerItemSelected]}
                      onPress={() => setLocalTime(prev => ({ ...prev, hour }))}
                    >
                      <Text style={[styles.pickerItemText, localTime.hour === hour && styles.pickerItemTextSelected]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map(minute => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.pickerItem, localTime.minute === minute && styles.pickerItemSelected]}
                      onPress={() => setLocalTime(prev => ({ ...prev, minute }))}
                    >
                      <Text style={[styles.pickerItemText, localTime.minute === minute && styles.pickerItemTextSelected]}>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Event</Text>
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
          <Text style={styles.label}>Event Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="e.g., Sunday Football"
          />
        </View>

        {/* Sport */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Sport *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSportPicker(true)}>
            <Text style={styles.pickerButtonText}>{formData.sport}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Team */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Team *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTeamPicker(true)}>
            <Text style={styles.pickerButtonText}>
              {teams.find(t => t.id === formData.teamId)?.name || 'Select team'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Start Date */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Start Date *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStartDatePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatDateForDisplay(formData.startDate)}</Text>
            <Text style={styles.pickerArrow}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* Start Time */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStartTimePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatTimeForDisplay(formData.startTime)}</Text>
            <Text style={styles.pickerArrow}>🕐</Text>
          </TouchableOpacity>
        </View>

        {/* End Date */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowEndDatePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatDateForDisplay(formData.endDate)}</Text>
            <Text style={styles.pickerArrow}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* End Time */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowEndTimePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatTimeForDisplay(formData.endTime)}</Text>
            <Text style={styles.pickerArrow}>🕐</Text>
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="Venue name"
          />
        </View>

        {/* Address */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Street address"
          />
        </View>

        {/* Postcode */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={formData.postcode}
            onChangeText={(text) => setFormData({ ...formData, postcode: text })}
            placeholder="e.g., SW1A 1AA"
            autoCapitalize="characters"
          />
        </View>

        {/* Gender */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowGenderPicker(true)}>
            <Text style={styles.pickerButtonText}>
              {GENDERS.find(g => g.value === formData.gender)?.label || 'Select'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Max Participants */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Max Participants</Text>
          <TextInput
            style={styles.input}
            value={formData.maxParticipants}
            onChangeText={(text) => setFormData({ ...formData, maxParticipants: text })}
            placeholder="e.g., 10"
            keyboardType="numeric"
          />
        </View>

        {/* Reserve Spots */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Reserve Spots</Text>
          <TextInput
            style={styles.input}
            value={formData.reserveSpots}
            onChangeText={(text) => setFormData({ ...formData, reserveSpots: text })}
            placeholder="e.g., 2"
            keyboardType="numeric"
          />
        </View>

        {/* Cost */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Cost (£)</Text>
          <TextInput
            style={styles.input}
            value={formData.cost}
            onChangeText={(text) => setFormData({ ...formData, cost: text })}
            placeholder="e.g., 10.00"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements}
            onChangeText={(text) => setFormData({ ...formData, requirements: text })}
            placeholder="Event details, requirements, what to bring, etc."
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
            <Text style={styles.label}>Payment Required</Text>
            <View style={[styles.toggle, formData.paymentRequired && styles.toggleActive]}>
              <View style={[styles.toggleKnob, formData.paymentRequired && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {formData.paymentRequired && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Max Player Payment (£) *</Text>
              <TextInput
                style={styles.input}
                value={formData.maxPlayerPayment}
                onChangeText={(text) => setFormData({ ...formData, maxPlayerPayment: text })}
                placeholder="e.g., 15.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Final Venue Cost (£) *</Text>
              <TextInput
                style={styles.input}
                value={formData.finalVenueCost}
                onChangeText={(text) => setFormData({ ...formData, finalVenueCost: text })}
                placeholder="e.g., 100.00"
                keyboardType="decimal-pad"
              />
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
        onSelect={(value) => setFormData({ ...formData, teamId: value })}
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
    maxHeight: '70%',
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
});
