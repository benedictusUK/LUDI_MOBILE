import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

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

export default function CreateTeamScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  
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
            maxLength={50}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Tell others about your team"
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
                  formData.sports.includes(sport) && styles.sportChipSelected
                ]}
                onPress={() => handleSportToggle(sport)}
              >
                <Text style={[
                  styles.sportChipText,
                  formData.sports.includes(sport) && styles.sportChipTextSelected
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
                  formData.color === color && styles.colorChipSelected
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
            keyboardType="numeric"
          />

          <Text style={styles.label}>Gender Preference</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              style={styles.picker}
            >
              <Picker.Item label="Mixed" value="mixed" />
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
            </Picker>
          </View>

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
                formData.isPrivate && styles.toggleActive
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
                formData.requiresApproval && styles.toggleActive
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
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
});