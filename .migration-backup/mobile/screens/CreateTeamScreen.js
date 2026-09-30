import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

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

const TEAM_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6366f1", // Indigo
];

const GENDERS = [
  { label: 'Mixed', value: 'mixed' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

export default function CreateTeamScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sports: [],
    color: TEAM_COLORS[0],
    maxPlayers: '',
    gender: 'mixed',
    isPrivate: false,
    requiresApproval: true,
  });

  const handleSportToggle = (sport) => {
    const currentSports = formData.sports;
    const updatedSports = currentSports.includes(sport)
      ? currentSports.filter(s => s !== sport)
      : [...currentSports, sport];
    
    setFormData({ ...formData, sports: updatedSports });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Team name is required');
      return;
    }

    if (formData.sports.length === 0) {
      Alert.alert('Error', 'Please select at least one sport');
      return;
    }

    try {
      setLoading(true);
      
      const teamData = {
        ...formData,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
      };

      const response = await apiRequest('/api/teams', {
        method: 'POST',
        body: JSON.stringify(teamData),
      });

      if (response.ok) {
        const newTeam = await response.json();
        Alert.alert('Success', 'Team created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('Create team error:', error);
      Alert.alert('Error', 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Team</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Team Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter team name"
            placeholderTextColor={colors.inputPlaceholder}
            maxLength={50}
          />

          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Tell others about your team"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <Text style={[styles.label, { color: colors.text }]}>Sports *</Text>
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>Select all sports your team plays</Text>
          <View style={styles.sportsGrid}>
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportChip,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                  formData.sports.includes(sport) && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff', borderColor: colors.primary }
                ]}
                onPress={() => handleSportToggle(sport)}
              >
                <Text style={[
                  styles.sportChipText,
                  { color: formData.sports.includes(sport) ? colors.primary : colors.text }
                ]}>
                  {sport}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Team Color</Text>
          <View style={styles.colorGrid}>
            {TEAM_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorChip,
                  { backgroundColor: color },
                  formData.color === color && styles.colorChipSelected
                ]}
                onPress={() => setFormData({ ...formData, color })}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Max Players</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={formData.maxPlayers}
            onChangeText={(text) => setFormData({ ...formData, maxPlayers: text })}
            placeholder="Leave empty for no limit"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.text }]}>Gender Preference</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>
              {GENDERS.find(g => g.value === formData.gender)?.label || 'Select gender'}
            </Text>
            <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
          </TouchableOpacity>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
            >
              <View style={styles.optionLeft}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Private Team</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
                  Only visible to invited members
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: colors.inputBackground },
                formData.isPrivate && { backgroundColor: colors.primary }
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.isPrivate && styles.toggleThumbActive
                ]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setFormData({ ...formData, requiresApproval: !formData.requiresApproval })}
            >
              <View style={styles.optionLeft}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Require Approval</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
                  Review join requests before accepting
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: colors.inputBackground },
                formData.requiresApproval && { backgroundColor: colors.primary }
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.requiresApproval && styles.toggleThumbActive
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
              {loading ? 'Creating Team...' : 'Create Team'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showGenderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Gender Preference</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.icon }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {GENDERS.map((option, index) => {
                const isSelected = formData.gender === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' }]}
                    onPress={() => {
                      setFormData({ ...formData, gender: option.value });
                      setShowGenderPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: isSelected ? colors.primary : colors.text }, isSelected && { fontWeight: '600' }]}>
                      {option.label}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheckmark, { color: colors.primary }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    gap: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 14,
    color: '#6b7280',
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
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sportChipSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  sportChipText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  sportChipTextSelected: {
    color: '#ffffff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorChipSelected: {
    borderColor: '#1e293b',
    borderWidth: 3,
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
  optionsContainer: {
    gap: 16,
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
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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