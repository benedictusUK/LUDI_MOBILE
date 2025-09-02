import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  RefreshControl 
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const { user, apiRequest } = useAuth();
  const navigation = useNavigation();
  const [dashboardData, setDashboardData] = useState({
    upcomingEvents: [],
    recentTeams: [],
    stats: { eventsCount: 0, teamsCount: 0, notificationsCount: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // Fetch recent events and teams
      const [eventsResponse, teamsResponse] = await Promise.all([
        apiRequest('/api/events?limit=3'),
        apiRequest('/api/teams?limit=3')
      ]);

      if (eventsResponse.ok && teamsResponse.ok) {
        const events = await eventsResponse.json();
        const teams = await teamsResponse.json();
        
        setDashboardData({
          upcomingEvents: events.slice(0, 3),
          recentTeams: teams.slice(0, 3),
          stats: {
            eventsCount: events.length,
            teamsCount: teams.length,
            notificationsCount: 0 // TODO: implement notifications count
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const profileComplete = user?.username && user?.dateOfBirth && user?.postcode && user?.gender;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hello, {user?.firstName || user?.username || 'User'}! 👋
          </Text>
          <Text style={styles.subtitle}>Ready to play?</Text>
        </View>

        {!profileComplete && (
          <TouchableOpacity 
            style={styles.profilePrompt}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.promptTitle}>Complete Your Profile</Text>
            <Text style={styles.promptSubtitle}>
              Add your details to unlock all features
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsContainer}>
          <StatCard 
            title="My Teams" 
            count={dashboardData.stats.teamsCount}
            onPress={() => navigation.navigate('Teams')}
          />
          <StatCard 
            title="Events" 
            count={dashboardData.stats.eventsCount}
            onPress={() => navigation.navigate('Events')}
          />
          <StatCard 
            title="Notifications" 
            count={dashboardData.stats.notificationsCount}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        {dashboardData.upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            </View>
            {dashboardData.upcomingEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => navigation.navigate('EventDetails', { id: event.id })}
              >
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventDate}>
                  {new Date(event.date).toLocaleDateString()}
                </Text>
                <Text style={styles.eventSport}>{event.sport}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {dashboardData.recentTeams.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Teams</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Teams')}>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            </View>
            {dashboardData.recentTeams.map((team) => (
              <View key={team.id} style={styles.teamCard}>
                <View style={[styles.teamColor, { backgroundColor: team.color || '#3b82f6' }]} />
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamSports}>
                    {team.sports?.slice(0, 2).join(', ')}
                    {team.sports?.length > 2 && ' +more'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('CreateTeam')}
            >
              <Text style={styles.actionButtonText}>Create Team</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Search')}
            >
              <Text style={styles.actionButtonText}>Find Events</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ title, count, onPress }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#ffffff',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  profilePrompt: {
    backgroundColor: '#fef3c7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  promptSubtitle: {
    fontSize: 14,
    color: '#92400e',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  section: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
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
  seeAllButton: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  eventCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  eventSport: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  teamColor: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  teamSports: {
    fontSize: 12,
    color: '#64748b',
  },
  quickActions: {
    margin: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
