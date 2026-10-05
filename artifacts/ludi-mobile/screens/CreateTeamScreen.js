import React, { useState } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { BrandText as Text, BrandTextInput as TextInput } from '../components/brand/BrandText';
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
  const { colors } = useTheme();
  const styles = useBrandStyles(createStyles(colors));
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Team</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={styles.label}>Team Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter team name"
            placeholderTextColor={colors.inputPlaceholder}
            selectionColor={colors.primary}
            maxLength={50}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Tell others about your team"
            placeholderTextColor={colors.inputPlaceholder}
            selectionColor={colors.primary}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <Text style={styles.label}>Sports *</Text>
          <Text style={styles.sublabel}>Select all sports your team plays</Text>
          <View style={styles.sportsGrid}>
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportChip,
                  formData.sports.includes(sport) && styles.sportChipSelected,
                ]}
                onPress={() => handleSportToggle(sport)}
              >
                <Text style={[
                  styles.sportChipText,
                  formData.sports.includes(sport) && styles.sportChipTextSelected,
                ]}>
                  {sport}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Team Color</Text>
          <View style={styles.colorGrid}>
            {TEAM_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorChip,
                  { backgroundColor: color },
                  formData.color === color && {
                    borderColor: colors.text,
                    borderWidth: 3,
                  }
                ]}
                onPress={() => setFormData({ ...formData, color })}
              />
            ))}
          </View>

          <Text style={styles.label}>Max Players</Text>
          <TextInput
            style={styles.input}
            value={formData.maxPlayers}
            onChangeText={(text) => setFormData({ ...formData, maxPlayers: text })}
            placeholder="Leave empty for no limit"
            placeholderTextColor={colors.inputPlaceholder}
            selectionColor={colors.primary}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Gender Preference</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {GENDERS.find(g => g.value === formData.gender)?.label || 'Select gender'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>Private Team</Text>
                <Text style={styles.optionSubtitle}>
                  Only visible to invited members
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: formData.isPrivate ? colors.primary : colors.disabled }
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
                <Text style={styles.optionTitle}>Require Approval</Text>
                <Text style={styles.optionSubtitle}>
                  Review join requests before accepting
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: formData.requiresApproval ? colors.primary : colors.disabled }
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
            <Text style={[
              styles.submitButtonText,
              loading && styles.submitButtonDisabledText,
            ]}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gender Preference</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {GENDERS.map((option, index) => {
                const isSelected = formData.gender === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.modalOption,
                      isSelected && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setFormData({ ...formData, gender: option.value });
                      setShowGenderPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                    {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
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

const createStyles = (colors) => StyleSheet.create({
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
    gap: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 14,
    color: colors.textSecondary,
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
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  sportChipSelected: {
    backgroundColor: colors.selectionBackground,
    borderColor: colors.primary,
  },
  sportChipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  sportChipTextSelected: {
    color: colors.selectionText,
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
  optionsContainer: {
    gap: 16,
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
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabledText: {
    color: colors.buttonSecondaryText,
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
    maxHeight: '70%',
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
});