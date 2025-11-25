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
import { useNavigation } from '@react-navigation/native';
import { calculateTotalAmount } from '../lib/paymentUtils';

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

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  
  // Modal states
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: SPORTS[0],
    startDate: '',
    startTime: '',
    endTime: '',
    location: '',
    address: '',
    postcode: '',
    teamId: '',
    maxParticipants: '',
    reserveSpots: '',
    cost: '',
    requirements: '',
    gender: 'mixed',
    recurrenceType: 'none',
    isPublished: true,
    paymentRequired: false,
    maxPlayerPayment: '',
    finalVenueCost: '',
  });

  const [platformCharges, setPlatformCharges] = useState([]);

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

    try {
      setLoading(true);
      
      const eventData = {
        name: formData.name,
        sport: formData.sport,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: null,
        endTime: formData.endTime || null,
        location: formData.location,
        address: formData.address || null,
        postcode: formData.postcode || null,
        primaryTeamId: formData.teamId,
        secondaryTeamIds: [],
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
        reserveSpots: formData.reserveSpots ? parseInt(formData.reserveSpots) : 0,
        cost: formData.cost || '0.00',
        requirements: formData.requirements || '',
        gender: formData.gender,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isPublished: formData.isPublished,
        paymentRequired: formData.paymentRequired,
        maxPlayerPayment: formData.paymentRequired && formData.maxPlayerPayment ? formData.maxPlayerPayment : null,
        finalVenueCost: formData.paymentRequired && formData.finalVenueCost ? formData.finalVenueCost : null,
      };

      const response = await apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        Alert.alert('Success', 'Event created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to create event');
      }
    } catch (error) {
      console.error('Create event error:', error);
      Alert.alert('Error', 'Failed to create event');
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

          <Text style={styles.label}>Team *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTeamPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getTeamLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Gender Restriction *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getGenderLabel()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Start Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={formData.startDate}
            onChangeText={(text) => setFormData({ ...formData, startDate: text })}
            placeholder="2024-12-25"
          />

          <Text style={styles.label}>Start Time * (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={formData.startTime}
            onChangeText={(text) => setFormData({ ...formData, startTime: text })}
            placeholder="14:30"
          />

          <Text style={styles.label}>End Time (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={formData.endTime}
            onChangeText={(text) => setFormData({ ...formData, endTime: text })}
            placeholder="16:30"
          />

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
});
