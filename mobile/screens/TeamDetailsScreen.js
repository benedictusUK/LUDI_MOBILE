import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function TeamDetailsScreen() {
  const { user, apiRequest } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params;

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const userRole = members.find(m => m.userId === user?.id)?.role;
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeamDetails();
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

  const handleRequestAction = async (requestId, action) => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/join-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        Alert.alert('Success', `Request ${action}d`);
        fetchTeamDetails();
      } else {
        Alert.alert('Error', `Failed to ${action} request`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} request`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading team details...</Text>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Team not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{team.name}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Team Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.teamHeader}>
            <View style={[styles.teamColorLarge, { backgroundColor: team.color || '#3b82f6' }]} />
            <View style={styles.teamMainInfo}>
              <Text style={styles.teamName}>{team.name}</Text>
              {team.description && (
                <Text style={styles.teamDescription}>{team.description}</Text>
              )}
            </View>
          </View>

          <View style={styles.sportsSection}>
            <Text style={styles.sectionLabel}>Sports</Text>
            <View style={styles.sportsContainer}>
              {team.sports?.map((sport, index) => (
                <View key={index} style={styles.sportChip}>
                  <Text style={styles.sportText}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            {isAdmin && pendingRequests.length > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingRequests.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{team.isPrivate ? 'Private' : 'Public'}</Text>
              <Text style={styles.statLabel}>Privacy</Text>
            </View>
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(true)}>
              <Text style={styles.seeAllButton}>See All</Text>
            </TouchableOpacity>
          </View>
          {members.slice(0, 3).map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.username}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pending Requests for Admins */}
        {isAdmin && pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests ({pendingRequests.length})</Text>
              <TouchableOpacity onPress={() => setShowPendingModal(true)}>
                <Text style={styles.seeAllButton}>Manage</Text>
              </TouchableOpacity>
            </View>
            {pendingRequests.slice(0, 2).map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <Text style={styles.requestName}>{request.username}</Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleRequestAction(request.id, 'approve')}
                  >
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRequestAction(request.id, 'reject')}
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
            <TouchableOpacity style={styles.actionButtonWrapper} onPress={() => setShowEditModal(true)}>
              <LinearGradient
                colors={['#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButton}
              >
                <Ionicons name="settings-outline" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Edit Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Team Members</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
              <Ionicons name="close" size={28} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberCard}>
                <View style={styles.memberCardInfo}>
                  <Text style={styles.memberCardName}>{member.username}</Text>
                  <Text style={styles.memberCardRole}>{member.role}</Text>
                </View>
                {isAdmin && member.role !== 'owner' && member.userId !== user.id && (
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.roleButton}
                      onPress={() => handleChangeRole(member.userId, member.username, member.role)}
                    >
                      <Text style={styles.roleButtonText}>Change Role</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveMember(member.userId, member.username)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pending Requests</Text>
            <TouchableOpacity onPress={() => setShowPendingModal(false)}>
              <Ionicons name="close" size={28} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <Text style={styles.requestCardName}>{request.username}</Text>
                <Text style={styles.requestCardDate}>
                  Requested {new Date(request.createdAt).toLocaleDateString()}
                </Text>
                <View style={styles.requestCardActions}>
                  <TouchableOpacity
                    style={styles.approveButtonLarge}
                    onPress={() => {
                      handleRequestAction(request.id, 'approve');
                      setShowPendingModal(false);
                    }}
                  >
                    <Text style={styles.approveTextLarge}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButtonLarge}
                    onPress={() => {
                      handleRequestAction(request.id, 'reject');
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberCardRole: {
    fontSize: 14,
    color: '#64748b',
    textTransform: 'capitalize',
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
});
