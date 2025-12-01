import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import HeaderWithNotifications from '../components/HeaderWithNotifications';

export default function TeamsScreen() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { apiRequest } = useAuth();

  const fetchTeams = async () => {
    try {
      const response = await apiRequest('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data || []);
      } else {
        Alert.alert('Error', 'Failed to load teams');
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      Alert.alert('Error', 'Unable to load teams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderWithNotifications title="Teams" />
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading teams...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HeaderWithNotifications title="Teams" />
      
      <FlatList
        contentContainerStyle={styles.list}
        data={teams}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.teamCard}>
            <View style={styles.teamHeader}>
              <View style={[styles.teamColor, { backgroundColor: item.color || '#3b82f6' }]} />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.teamDescription}>{item.description}</Text>
                )}
              </View>
            </View>
            
            <View style={styles.teamFooter}>
              <View style={styles.sportsContainer}>
                {item.sports?.slice(0, 3).map((sport, index) => (
                  <Text key={index} style={styles.sportTag}>
                    {sport}
                  </Text>
                ))}
                {item.sports?.length > 3 && (
                  <Text style={styles.sportTag}>+{item.sports.length - 3}</Text>
                )}
              </View>
              
              <Text style={styles.memberCount}>
                {item.memberCount || 0} members
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No teams yet</Text>
            <Text style={styles.emptySubtext}>
              Create or join a team to start organizing events!
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('CreateTeam')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3b82f6', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  teamCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  teamDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 12,
  },
  sportTag: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
});
