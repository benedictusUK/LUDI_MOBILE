import React, { useState, useEffect } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Modal } from 'react-native';
import { BrandText as Text, BrandTextInput as TextInput } from '../components/brand/BrandText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import HeaderWithNotifications from '../components/HeaderWithNotifications';
import SuperAdminShortcut from '../components/SuperAdminShortcut';
import UserAvatar from '../components/UserAvatar';
import ProfilePictureEditor from '../components/ProfilePictureEditor';

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
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

export default function ProfileScreen({ navigation }) {
  const styles = useBrandStyles(baseStyles, { navClearance: 112 });
  const { user, updateUser, apiRequest, signOut } = useAuth();
  const { themeMode, changeTheme, colors, isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
    dateOfBirth: user?.dateOfBirth || '',
    postcode: user?.postcode || '',
    gender: user?.gender || '',
    sportsInterests: user?.sportsInterests || [],
    travelRadius: user?.travelRadius || 10,
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: user.dateOfBirth || '',
        postcode: user.postcode || '',
        gender: user.gender || '',
        sportsInterests: user.sportsInterests || [],
        travelRadius: user.travelRadius || 10,
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const response = await apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        updateUser(updatedUser);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSportToggle = (sport) => {
    const currentSports = profileData.sportsInterests;
    const updatedSports = currentSports.includes(sport)
      ? currentSports.filter(s => s !== sport)
      : [...currentSports, sport];
    
    setProfileData({ ...profileData, sportsInterests: updatedSports });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const profileComplete = user?.username && user?.dateOfBirth && user?.postcode && user?.gender;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <HeaderWithNotifications title="Profile" />
      <ScrollView style={styles.scrollView}>
        <View style={[styles.profileSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <UserAvatar user={user} size={100} style={styles.profileImage} />
          <ProfilePictureEditor key={user?.id} />
          <Text style={[styles.name, { color: colors.text }]}>
            {user?.firstName || user?.lastName ? 
              `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
              'Unknown User'}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
          
          {!profileComplete && (
            <View style={styles.incompleteNotice}>
              <Text style={styles.incompleteText}>
                Complete your profile to access all features
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={[styles.editButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.editButtonText}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text }]}>First Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.firstName}
                onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
                placeholder="Enter first name"
                placeholderTextColor={colors.inputPlaceholder}
              />

              <Text style={[styles.label, { color: colors.text }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.lastName}
                onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
                placeholder="Enter last name"
                placeholderTextColor={colors.inputPlaceholder}
              />

              <Text style={[styles.label, { color: colors.text }]}>Username *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.username}
                onChangeText={(text) => setProfileData({ ...profileData, username: text })}
                placeholder="Enter username"
                placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.phoneNumber}
                onChangeText={(text) => setProfileData({ ...profileData, phoneNumber: text })}
                placeholder="Enter phone number"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { color: colors.text }]}>Date of Birth * (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.dateOfBirth}
                onChangeText={(text) => setProfileData({ ...profileData, dateOfBirth: text })}
                placeholder="1990-01-01"
                placeholderTextColor={colors.inputPlaceholder}
              />

              <Text style={[styles.label, { color: colors.text }]}>Postcode *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={profileData.postcode}
                onChangeText={(text) => setProfileData({ ...profileData, postcode: text })}
                placeholder="Enter postcode"
                placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { color: colors.text }]}>Gender *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.inputText }]}>
                  {GENDERS.find(g => g.value === profileData.gender)?.label || 'Select gender'}
                </Text>
                <Text style={[styles.pickerArrow, { color: colors.icon }]}>▼</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.text }]}>Travel Radius (km)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={String(profileData.travelRadius)}
                onChangeText={(text) => setProfileData({ ...profileData, travelRadius: parseInt(text) || 10 })}
                placeholder="10"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoView}>
              <InfoRow label="Username" value={user?.username || 'Not set'} />
              <InfoRow label="Phone" value={user?.phoneNumber || 'Not set'} />
              <InfoRow label="Date of Birth" value={user?.dateOfBirth || 'Not set'} />
              <InfoRow label="Postcode" value={user?.postcode || 'Not set'} />
              <InfoRow label="Gender" value={user?.gender || 'Not set'} />
              <InfoRow label="Travel Radius" value={`${user?.travelRadius || 10} km`} />
            </View>
          )}
        </View>

        {/* Payment Methods Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payments</Text>
          <TouchableOpacity
            style={[styles.themeButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => navigation.navigate('PaymentMethods')}
            data-testid="button-payment-methods"
          >
            <View style={styles.themeButtonContent}>
              <View style={styles.themeButtonLeft}>
                <Ionicons name="card-outline" size={20} color={colors.icon} />
                <Text style={[styles.themeButtonLabel, { color: colors.text }]}>Payment Methods</Text>
              </View>
              <View style={styles.themeButtonRight}>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <SuperAdminShortcut />

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <TouchableOpacity
            style={[styles.themeButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={() => setShowThemePicker(true)}
          >
            <View style={styles.themeButtonContent}>
              <View style={styles.themeButtonLeft}>
                <Ionicons 
                  name={themeMode === 'light' ? 'sunny' : themeMode === 'dark' ? 'moon' : 'phone-portrait'} 
                  size={20} 
                  color={colors.icon} 
                />
                <Text style={[styles.themeButtonLabel, { color: colors.text }]}>Theme</Text>
              </View>
              <View style={styles.themeButtonRight}>
                <Text style={[styles.themeButtonValue, { color: colors.textSecondary }]}>
                  {themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Interests</Text>
          {isEditing ? (
            <View>
              {profileData.sportsInterests.length > 0 && (
                <View style={styles.selectedSportsContainer}>
                  {profileData.sportsInterests.map((sport) => (
                    <View key={sport} style={[styles.selectedSportChip, { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
                      <Text style={[styles.selectedSportText, { color: colors.primary }]}>{sport}</Text>
                      <TouchableOpacity onPress={() => handleSportToggle(sport)}>
                        <Ionicons name="close-circle" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={[styles.sportsListContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <ScrollView style={styles.sportsList} nestedScrollEnabled>
                  {SPORTS.map((sport) => (
                    <TouchableOpacity
                      key={sport}
                      style={[styles.sportListItem, { borderBottomColor: colors.borderLight }]}
                      onPress={() => handleSportToggle(sport)}
                    >
                      <View style={[
                        styles.sportCheckbox,
                        { borderColor: colors.inputBorder },
                        profileData.sportsInterests.includes(sport) && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}>
                        {profileData.sportsInterests.includes(sport) && (
                          <Ionicons name="checkmark" size={16} color={colors.buttonText} />
                        )}
                      </View>
                      <Text style={[styles.sportListText, { color: colors.text }]}>{sport}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : (
            <View style={styles.selectedSportsContainer}>
              {(user?.sportsInterests || []).map((sport) => (
                <View key={sport} style={[styles.selectedSportChip, { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
                  <Text style={[styles.selectedSportText, { color: colors.primary }]}>{sport}</Text>
                </View>
              ))}
              {(!user?.sportsInterests || user.sportsInterests.length === 0) && (
                <Text style={[styles.noSports, { color: colors.textSecondary }]}>No interests selected</Text>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.error }]} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Gender</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.icon }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {GENDERS.map((option, index) => {
                const isSelected = profileData.gender === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalOption, { borderBottomColor: colors.borderLight }, isSelected && { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}
                    onPress={() => {
                      setProfileData({ ...profileData, gender: option.value });
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

      <Modal
        visible={showThemePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Theme</Text>
              <TouchableOpacity onPress={() => setShowThemePicker(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {[
                { label: 'Light', value: 'light', icon: 'sunny' },
                { label: 'Dark', value: 'dark', icon: 'moon' },
                { label: 'System', value: 'system', icon: 'phone-portrait' },
              ].map((option, index) => {
                const isSelected = themeMode === option.value;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.modalOption,
                      { borderBottomColor: colors.borderLight },
                      isSelected && { backgroundColor: colors.selectionBackground },
                    ]}
                    onPress={() => {
                      changeTheme(option.value);
                      setShowThemePicker(false);
                    }}
                  >
                    <View style={styles.themeOption}>
                      <Ionicons name={option.icon} size={20} color={isSelected ? colors.selectionText : colors.icon} />
                      <Text style={[styles.modalOptionText, { color: isSelected ? colors.selectionText : colors.text }]}>
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.selectionText} />}
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

function InfoRow({ label, value }) {
  const styles = useBrandStyles(baseStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#64748b',
  },
  incompleteNotice: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  incompleteText: {
    color: '#92400e',
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 16,
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
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoView: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  },
  sportChipTextSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedSportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginTop: 12,
  },
  selectedSportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 6,
  },
  selectedSportText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  sportsListContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    maxHeight: 300,
  },
  sportsList: {
    maxHeight: 300,
  },
  sportListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  sportCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCheckboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  sportListText: {
    fontSize: 15,
    color: '#1e293b',
    flex: 1,
  },
  noSports: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  signOutButton: {
    margin: 16,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
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
  themeButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  themeButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  themeButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeButtonLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  themeButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeButtonValue: {
    fontSize: 14,
    color: '#64748b',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
