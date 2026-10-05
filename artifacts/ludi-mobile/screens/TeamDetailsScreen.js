import React, { useEffect, useState } from 'react';
import useBrandStyles from '../components/brand/useBrandStyles';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, Platform, FlatList, Switch, ActivityIndicator } from 'react-native';
import { BrandText as Text, BrandTextInput as TextInput } from '../components/brand/BrandText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';

const SPORTS_OPTIONS = [
  'Team Social',
  'Badminton',
  'Basketball',
  'Boxing',
  'Cricket',
  'Cycling',
  'Fitness Training',
  'Football',
  'Golf',
  'Hiking',
  'Hockey',
  'Martial Arts',
  'Other',
  'Paddle',
  'Rugby',
  'Running',
  'Squash',
  'Swimming',
  'Table Tennis',
  'Tennis',
  'Volleyball',
  'Walking',
  'Wild Camping',
  'Yoga',
];

export default function TeamDetailsScreen() {
  const styles = useBrandStyles(baseStyles);
  const { user, apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params;

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSports, setEditSports] = useState([]);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editRequiresApproval, setEditRequiresApproval] = useState(false);

  // User search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Helper function to get display role
  const getDisplayRole = (member) => {
    if (!team) return member.role;
    if (member.userId === team.ownerId) return 'owner';
    return member.role;
  };

  // Helper function to get display name
  const getDisplayName = (user) => {
    if (!user) return 'Unknown';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || 'Unknown';
  };

  const userMembership = members.find(m => m.userId === user?.id);
  const userRole = userMembership ? getDisplayRole(userMembership) : null;
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;

  useEffect(() => {
    fetchTeamDetails();
  }, [teamId]);

  const fetchTeamDetails = async () => {
    try {
      const [teamResponse, membersResponse, requestsResponse] = await Promise.all([
        apiRequest(`/api/teams/${teamId}`),
        apiRequest(`/api/teams/${teamId}/members`),
        apiRequest(`/api/teams/${teamId}/pending-requests`),
      ]);

      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        setTeam(teamData);
        // Initialize edit form
        setEditName(teamData.name);
        setEditDescription(teamData.description || '');
        setEditSports(teamData.sports || []);
        setEditIsPrivate(teamData.isPrivate || false);
        setEditRequiresApproval(teamData.requiresApproval || false);
      }

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setPendingRequests(requestsData);
      }
    } catch (error) {
      console.error('Failed to fetch team details:', error);
      Alert.alert('Error', 'Failed to load team details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/blocked-users`);
      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeamDetails();
  };

  const handleSaveSettings = async () => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          sports: editSports,
          isPrivate: editIsPrivate,
          requiresApproval: editRequiresApproval,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Team settings updated');
        setShowEditModal(false);
        fetchTeamDetails();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update team settings');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update team settings');
    }
  };

  const toggleSport = (sport) => {
    if (editSports.includes(sport)) {
      setEditSports(editSports.filter(s => s !== sport));
    } else {
      setEditSports([...editSports, sport]);
    }
  };

  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out users already in the team
        const memberIds = members.map(m => m.userId);
        const filteredResults = data.filter(u => !memberIds.includes(u.id));
        setSearchResults(filteredResults);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInviteUser = async (userId, username) => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        Alert.alert('Success', `Invitation sent to ${username}`);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to send invitation');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    }
  };

  const handleBlockUser = async (userId, username) => {
    Alert.alert(
      'Block User',
      `Block ${username} from joining this team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/teams/${teamId}/blocked-users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
              });

              if (response.ok) {
                Alert.alert('Success', `${username} has been blocked`);
                setSearchQuery('');
                setSearchResults([]);
                fetchBlockedUsers();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'Failed to block user');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async (userId, username) => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/blocked-users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        Alert.alert('Success', `${username} has been unblocked`);
        fetchBlockedUsers();
      } else {
        Alert.alert('Error', 'Failed to unblock user');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to unblock user');
    }
  };

  const handleLeaveTeam = () => {
    Alert.alert(
      'Leave Team',
      `Are you sure you want to leave ${team.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/teams/${teamId}/members/${user.id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                Alert.alert('Success', 'You have left the team');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to leave team');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to leave team');
            }
          },
        },
      ]
    );
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to permanently delete ${team.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/teams/${teamId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                Alert.alert('Success', 'Team deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to delete team');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete team');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (memberId, memberName) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/teams/${teamId}/members/${memberId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                Alert.alert('Success', 'Member removed');
                fetchTeamDetails();
              } else {
                Alert.alert('Error', 'Failed to remove member');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = (memberId, memberName, currentRole) => {
    const roles = ['member', 'captain', 'admin'];
    const roleOptions = roles.map(role => ({
      text: role.charAt(0).toUpperCase() + role.slice(1),
      onPress: async () => {
        try {
          const response = await apiRequest(`/api/teams/${teamId}/members/${memberId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          });
          if (response.ok) {
            Alert.alert('Success', `Role updated to ${role}`);
            fetchTeamDetails();
          } else {
            Alert.alert('Error', 'Failed to update role');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to update role');
        }
      },
    }));

    Alert.alert(
      'Change Role',
      `Select new role for ${memberName}:`,
      [...roleOptions, { text: 'Cancel', style: 'cancel' }]
    );
  };

  const handleRequestAction = async (userId, action) => {
    try {
      const endpoint = action === 'approve' 
        ? `/api/teams/${teamId}/approve-join/${userId}`
        : `/api/teams/${teamId}/reject-join/${userId}`;
      
      const response = await apiRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        Alert.alert('Success', `Request ${action === 'approve' ? 'approved' : 'rejected'}`);
        fetchTeamDetails();
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.message || `Failed to ${action} request`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} request`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>Loading team details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>Team not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={[styles.loadingText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{team.name}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Team Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.teamHeader}>
            <View style={[styles.teamColorLarge, { backgroundColor: team.color || '#3d86e8' }]} />
            <View style={styles.teamMainInfo}>
              <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
              {team.description && (
                <Text style={[styles.teamDescription, { color: colors.textSecondary }]}>{team.description}</Text>
              )}
            </View>
          </View>

          <View style={[styles.sportsSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Sports</Text>
            <View style={styles.sportsContainer}>
              {team.sports?.map((sport, index) => (
                <View key={index} style={[styles.sportChip, { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb' }]}>
                  <Text style={[styles.sportText, { color: colors.primary }]}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{members.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
            </View>
            {isAdmin && pendingRequests.length > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{pendingRequests.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{team.isPrivate ? 'Private' : 'Public'}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Privacy</Text>
            </View>
          </View>
        </View>

        {/* Members Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Members ({members.length})</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(true)}>
              <Text style={[styles.seeAllButton, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {members.slice(0, 3).map((member) => (
            <View key={member.userId} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>{getDisplayName(member.user)}</Text>
                <Text style={[styles.memberUsername, { color: colors.textSecondary }]}>@{member.user?.username || 'unknown'}</Text>
                <Text style={[styles.memberRole, { color: colors.primary }]}>{getDisplayRole(member)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pending Requests for Admins */}
        {isAdmin && pendingRequests.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Requests ({pendingRequests.length})</Text>
              <TouchableOpacity onPress={() => setShowPendingModal(true)}>
                <Text style={[styles.seeAllButton, { color: colors.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            {pendingRequests.slice(0, 2).map((request) => (
              <View key={request.id} style={[styles.requestRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.requestName, { color: colors.text }]}>{getDisplayName(request.user)}</Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleRequestAction(request.userId, 'approve')}
                  >
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRequestAction(request.userId, 'reject')}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {isAdmin && (
            <>
              <TouchableOpacity style={styles.actionButtonWrapper} onPress={() => setShowEditModal(true)}>
                <LinearGradient
                  colors={['#1d5183', '#0d2a47']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButton}
                >
                  <Ionicons name="settings-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButtonWrapper} onPress={() => setShowInviteModal(true)}>
                <LinearGradient
                  colors={['#1d5183', '#0d2a47']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButton}
                >
                  <Ionicons name="person-add-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Invite Players</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButtonWrapper} 
                onPress={() => {
                  setShowBlockModal(true);
                  fetchBlockedUsers();
                }}
              >
                <LinearGradient
                  colors={['#1d5183', '#0d2a47']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButton}
                >
                  <Ionicons name="ban-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Block Users</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButtonWrapper} 
                onPress={() => navigation.navigate('BlockedMembers', { teamId: team.id, teamName: team.name })}
                data-testid="button-view-blocked"
              >
                <LinearGradient
                  colors={['#1d5183', '#0d2a47']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButton}
                >
                  <Ionicons name="shield-outline" size={20} color="#ffffff" />
                  <Text style={styles.actionButtonText}>View Blocked</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {!isOwner && (
            <TouchableOpacity style={styles.actionButtonWrapper} onPress={handleLeaveTeam}>
              <View style={styles.dangerButton}>
                <Ionicons name="exit-outline" size={20} color="#ef4444" />
                <Text style={styles.dangerButtonText}>Leave Team</Text>
              </View>
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity style={styles.actionButtonWrapper} onPress={handleDeleteTeam}>
              <View style={styles.dangerButton}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={styles.dangerButtonText}>Delete Team</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Team Members</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {members.map((member) => {
              const displayRole = getDisplayRole(member);
              const displayName = getDisplayName(member.user);
              return (
                <View key={member.userId} style={[styles.memberCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                  <View style={styles.memberCardInfo}>
                    <Text style={[styles.memberCardName, { color: colors.text }]}>{displayName}</Text>
                    <Text style={[styles.memberCardUsername, { color: colors.textSecondary }]}>@{member.user?.username || 'unknown'}</Text>
                    <Text style={[styles.memberCardRole, { color: colors.primary }]}>{displayRole}</Text>
                  </View>
                  {isAdmin && displayRole !== 'owner' && member.userId !== user.id && (
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={styles.roleButton}
                        onPress={() => handleChangeRole(member.userId, displayName, displayRole)}
                      >
                        <Text style={styles.roleButtonText}>Change Role</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member.userId, displayName)}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Pending Requests Modal */}
      <Modal
        visible={showPendingModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPendingModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Pending Requests</Text>
            <TouchableOpacity onPress={() => setShowPendingModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {pendingRequests.map((request) => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.requestCardName, { color: colors.text }]}>{getDisplayName(request.user)}</Text>
                {request.user?.username && (
                  <Text style={[styles.requestCardUsername, { color: colors.textSecondary }]}>@{request.user.username}</Text>
                )}
                <Text style={[styles.requestCardDate, { color: colors.textSecondary }]}>
                  Requested {new Date(request.invitedAt).toLocaleDateString()}
                </Text>
                <View style={styles.requestCardActions}>
                  <TouchableOpacity
                    style={styles.approveButtonLarge}
                    onPress={() => {
                      handleRequestAction(request.userId, 'approve');
                      setShowPendingModal(false);
                    }}
                  >
                    <Text style={styles.approveTextLarge}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButtonLarge}
                    onPress={() => {
                      handleRequestAction(request.userId, 'reject');
                      setShowPendingModal(false);
                    }}
                  >
                    <Text style={styles.rejectTextLarge}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Settings Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={[styles.cancelButton, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Team Settings</Text>
            <TouchableOpacity onPress={handleSaveSettings}>
              <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Team Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter team name"
                placeholderTextColor={colors.inputPlaceholder}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Enter team description"
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Sports & Activities</Text>
              {editSports.length > 0 && (
                <View style={styles.selectedSportsContainer}>
                  {editSports.map((sport) => (
                    <View key={sport} style={[styles.selectedSportChip, { backgroundColor: isDark ? 'rgba(114, 170, 255, 0.2)' : '#e3eefb', borderColor: colors.primary }]}>
                      <Text style={[styles.selectedSportText, { color: colors.primary }]}>{sport}</Text>
                      <TouchableOpacity onPress={() => toggleSport(sport)}>
                        <Ionicons name="close-circle" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={[styles.sportsListContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView style={styles.sportsList} nestedScrollEnabled>
                  {SPORTS_OPTIONS.map((sport) => (
                    <TouchableOpacity
                      key={sport}
                      style={styles.sportListItem}
                      onPress={() => toggleSport(sport)}
                    >
                      <View style={[
                        styles.sportCheckbox,
                        { borderColor: colors.border },
                        editSports.includes(sport) && { ...styles.sportCheckboxSelected, backgroundColor: colors.primary }
                      ]}>
                        {editSports.includes(sport) && (
                          <Ionicons name="checkmark" size={16} color={colors.buttonText} />
                        )}
                      </View>
                      <Text style={[styles.sportListText, { color: colors.text }]}>{sport}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Private Team</Text>
                  <Text style={[styles.formHint, { color: colors.textSecondary }]}>Only invited members can join</Text>
                </View>
                <Switch
                  value={editIsPrivate}
                  onValueChange={setEditIsPrivate}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Requires Approval</Text>
                  <Text style={[styles.formHint, { color: colors.textSecondary }]}>Review join requests before accepting</Text>
                </View>
                <Switch
                  value={editRequiresApproval}
                  onValueChange={setEditRequiresApproval}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Invite Players Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowInviteModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Players</Text>
            <TouchableOpacity onPress={() => {
              setShowInviteModal(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
              value={searchQuery}
              onChangeText={handleSearchUsers}
              placeholder="Search users by username..."
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>
          <ScrollView style={styles.modalContent}>
            {searchLoading && (
              <Text style={[styles.searchingText, { color: colors.textSecondary }]}>Searching...</Text>
            )}
            {searchResults.map((result) => (
              <View key={result.id} style={[styles.searchResultCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultName, { color: colors.text }]}>{getDisplayName(result)}</Text>
                  <Text style={[styles.searchResultUsername, { color: colors.textSecondary }]}>@{result.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.inviteButton}
                  onPress={() => handleInviteUser(result.id, getDisplayName(result))}
                >
                  <Text style={styles.inviteButtonText}>Invite</Text>
                </TouchableOpacity>
              </View>
            ))}
            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No users found</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Block Users Modal */}
      <Modal
        visible={showBlockModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowBlockModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Block Users</Text>
            <TouchableOpacity onPress={() => {
              setShowBlockModal(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Blocked Users List */}
          {blockedUsers.length > 0 && (
            <View style={[styles.blockedSection, { borderBottomColor: colors.border }]}>
              <Text style={[styles.blockedSectionTitle, { color: colors.text }]}>Blocked Users</Text>
              <ScrollView style={styles.blockedList}>
                {blockedUsers.map((blocked) => (
                  <View key={blocked.userId} style={[styles.blockedUserCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.blockedUserName, { color: colors.text }]}>{getDisplayName(blocked.user)}</Text>
                      <Text style={[styles.blockedUserUsername, { color: colors.textSecondary }]}>@{blocked.user?.username || 'unknown'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockButton}
                      onPress={() => handleUnblockUser(blocked.userId, getDisplayName(blocked.user))}
                    >
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search to Block */}
          <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
              value={searchQuery}
              onChangeText={handleSearchUsers}
              placeholder="Search users to block..."
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>
          <ScrollView style={styles.modalContent}>
            {searchLoading && (
              <Text style={[styles.searchingText, { color: colors.textSecondary }]}>Searching...</Text>
            )}
            {searchResults.map((result) => (
              <View key={result.id} style={[styles.searchResultCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultName, { color: colors.text }]}>{getDisplayName(result)}</Text>
                  <Text style={[styles.searchResultUsername, { color: colors.textSecondary }]}>@{result.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.blockButton}
                  onPress={() => handleBlockUser(result.id, getDisplayName(result))}
                >
                  <Text style={styles.blockButtonText}>Block</Text>
                </TouchableOpacity>
              </View>
            ))}
            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No users found</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
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
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  teamHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  teamColorLarge: {
    width: 6,
    borderRadius: 3,
    marginRight: 16,
  },
  teamMainInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  teamDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  sportsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  sportText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  seeAllButton: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#3b82f6',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  requestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rejectText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsSection: {
    marginHorizontal: 16,
    marginBottom: 32,
    gap: 12,
  },
  actionButtonWrapper: {
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ef4444',
    gap: 8,
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  cancelButton: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  saveButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  memberCardInfo: {
    marginBottom: 12,
  },
  memberCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberCardUsername: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  memberCardRole: {
    fontSize: 14,
    color: '#3b82f6',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  roleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  requestCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  requestCardUsername: {
    fontSize: 14,
    marginBottom: 4,
  },
  requestCardDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  requestCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButtonLarge: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveTextLarge: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonLarge: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  rejectTextLarge: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectedSportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  searchingText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    marginTop: 20,
  },
  searchResultCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  searchResultUsername: {
    fontSize: 12,
    color: '#64748b',
  },
  inviteButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  blockButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  blockButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    marginTop: 20,
  },
  blockedSection: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    maxHeight: 200,
  },
  blockedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  blockedList: {
    maxHeight: 150,
  },
  blockedUserCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  blockedUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  blockedUserUsername: {
    fontSize: 12,
    color: '#64748b',
  },
  unblockButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unblockButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
