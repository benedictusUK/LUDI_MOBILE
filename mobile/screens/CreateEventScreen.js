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

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: SPORTS[0],
    date: '',
    time: '',
    location: '',
    teamId: '',
    maxAttendees: '',
    cost: '',
    isPublic: true,
    allowReserves: true,
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
        if (teamsData.length > 0) {
          setFormData(prev => ({ ...prev, teamId: teamsData[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    if (!formData.date) {
      Alert.alert('Error', 'Event date is required');
      return;
    }

    if (!formData.teamId) {
      Alert.alert('Error', 'Please select a team');
      return;
    }

    try {
      setLoading(true);
      
      // Combine date and time
      const eventDateTime = formData.time ? 
        `${formData.date}T${formData.time}:00` : 
        `${formData.date}T12:00:00`;

      const eventData = {
        name: formData.name,
        description: formData.description,
        sport: formData.sport,
        date: eventDateTime,
        location: formData.location,
        teamId: formData.teamId,
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        isPublic: formData.isPublic,
        allowReserves: formData.allowReserves,
      };

      const response = await apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        const newEvent = await response.json();
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

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Describe your event"
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <Text style={styles.label}>Sport *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.sport}
              onValueChange={(value) => setFormData({ ...formData, sport: value })}
              style={styles.picker}
            >
              {SPORTS.map((sport) => (
                <Picker.Item key={sport} label={sport} value={sport} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Team *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.teamId}
              onValueChange={(value) => setFormData({ ...formData, teamId: value })}
              style={styles.picker}
            >
              {teams.length === 0 ? (
                <Picker.Item label="No teams available" value="" />
              ) : (
                teams.map((team) => (
                  <Picker.Item key={team.id} label={team.name} value={team.id} />
                ))
              )}
            </Picker>
          </View>

          <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={formData.date}
            onChangeText={(text) => setFormData({ ...formData, date: text })}
            placeholder="2024-12-25"
          />

          <Text style={styles.label}>Time (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={formData.time}
            onChangeText={(text) => setFormData({ ...formData, time: text })}
            placeholder="14:30"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="Enter location"
          />

          <Text style={styles.label}>Max Attendees</Text>
          <TextInput
            style={styles.input}
            value={formData.maxAttendees}
            onChangeText={(text) => setFormData({ ...formData, maxAttendees: text })}
            placeholder="Leave empty for no limit"
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

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setFormData({ ...formData, isPublic: !formData.isPublic })}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>Public Event</Text>
                <Text style={styles.optionSubtitle}>
                  Visible in flare search
                </Text>
              </View>
              <View style={[
                styles.toggle,
                formData.isPublic && styles.toggleActive
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.isPublic && styles.toggleThumbActive
                ]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setFormData({ ...formData, allowReserves: !formData.allowReserves })}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>Allow Reserves</Text>
                <Text style={styles.optionSubtitle}>
                  Enable reserve player system
                </Text>
              </View>
              <View style={[
                styles.toggle,
                formData.allowReserves && styles.toggleActive
              ]}>
                <View style={[
                  styles.toggleThumb,
                  formData.allowReserves && styles.toggleThumbActive
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