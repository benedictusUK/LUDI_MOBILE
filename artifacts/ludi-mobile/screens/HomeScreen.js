import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import HeaderWithNotifications from '../components/HeaderWithNotifications';
import { useDashboardData } from '../contexts/DashboardDataContext';
import { useNotifications } from '../contexts/NotificationContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { data, loading, error: dashboardError, reload } = useDashboardData();
  const { unreadCount } = useNotifications();
  const dashboardData = { ...data, stats: { ...data.stats, notificationsCount: unreadCount } };
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      await reload();
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Check if event is active (for highlighting) - based on date range
  const isEventActive = (event) => {
    if (!event.startDate) return false;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of day for date comparison
    
    const startDate = new Date(event.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
    endDate.setHours(0, 0, 0, 0);
    
    // Event is active if current date is within the event date range
    return now >= startDate && now <= endDate;
  };

  // Check if LIVE tag should show - based on time range
  const isLiveEvent = (event) => {
    if (!event.startDate || !event.startTime) return false;
    
    const now = new Date();
    const startDateTime = new Date(`${event.startDate}T${event.startTime}`);
    
    // If no end time, consider it live for 2 hours after start
    let endDateTime;
    if (event.endTime) {
      const endDate = event.endDate || event.startDate;
      endDateTime = new Date(`${endDate}T${event.endTime}`);
    } else {
      endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    }
    
    // LIVE tag only shows if current time is between start and end times
    return now >= startDateTime && now <= endDateTime;
  };

  const profileComplete = user?.username && user?.dateOfBirth && user?.postcode && user?.gender;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <HeaderWithNotifications title="Home" />
      {dashboardError && (
        <TouchableOpacity accessibilityRole="button" onPress={onRefresh} style={{ padding: 16 }}>
          <Text style={{ color: colors.error }}>{dashboardError} Tap to retry.</Text>
        </TouchableOpacity>
      )}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetingContainer}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hello, {user?.firstName || user?.username || 'User'}! 👋
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Ready to play?</Text>
        </View>

        {!profileComplete && (
          <TouchableOpacity 
            style={[styles.profilePrompt, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', borderLeftColor: '#f59e0b' }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={[styles.promptTitle, { color: isDark ? '#fbbf24' : '#92400e' }]}>Complete Your Profile</Text>
            <Text style={[styles.promptSubtitle, { color: isDark ? '#fbbf24' : '#92400e' }]}>
              Add your details to unlock all features
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsContainer}>
          <StatCard 
            title="My Teams" 
            count={dashboardData.stats.teamsCount}
            onPress={() => navigation.navigate('Teams')}
            colors={colors}
          />
          <StatCard 
            title="Events" 
            count={dashboardData.stats.eventsCount}
            onPress={() => navigation.navigate('Events')}
            colors={colors}
          />
        </View>

        {dashboardData.upcomingEvents.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                <Text style={[styles.seeAllButton, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {dashboardData.upcomingEvents.map((event) => {
              const isActive = isEventActive(event);
              const isLive = isLiveEvent(event);
              
              const cardContent = (
                <View style={[styles.eventCardInner, { backgroundColor: isActive ? 'transparent' : colors.cardSecondary }]}>
                  <View style={styles.eventHeader}>
                    <Text style={[styles.eventTitle, { color: isActive ? '#ffffff' : colors.text }]}>{event.name}</Text>
                    {isLive && <Text style={styles.liveBadge}>LIVE</Text>}
                  </View>
                  <Text style={[styles.eventDate, { color: isActive ? '#ffffff' : colors.textSecondary }]}>
                    {event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Date TBD'} • {event.startTime || 'Time TBD'}
                  </Text>
                  <Text style={[styles.eventSport, { color: isActive ? '#ffffff' : colors.primary }]}>{event.sport}</Text>
                </View>
              );

              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => navigation.navigate('EventDetails', { id: event.id })}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#3b82f6', '#10b981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.eventCardGradient}
                    >
                      {cardContent}
                    </LinearGradient>
                  ) : (
                    cardContent
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {dashboardData.recentTeams.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Teams</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Teams')}>
                <Text style={[styles.seeAllButton, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {dashboardData.recentTeams.map((team) => (
              <View key={team.id} style={[styles.teamCard, { backgroundColor: colors.cardSecondary }]}>
                <View style={[styles.teamColor, { backgroundColor: team.color || '#3b82f6' }]} />
                <View style={styles.teamInfo}>
                  <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                  <Text style={[styles.teamSports, { color: colors.textSecondary }]}>
                    {team.sports?.slice(0, 2).join(', ')}
                    {team.sports?.length > 2 && ' +more'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButtonWrapper}
              onPress={() => navigation.navigate('CreateTeam')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>Create Team</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButtonWrapper}
              onPress={() => navigation.navigate('CreateEvent')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>Create Event</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ title, count, onPress, colors }) {
  return (
    <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.card }]} onPress={onPress}>
      <Text style={[styles.statCount, { color: colors.primary }]}>{count}</Text>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
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
  greetingContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  profilePrompt: {
    margin: 16,
    marginTop: 0,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptSubtitle: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
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
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    margin: 16,
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
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventCard: {
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventCardInner: {
    padding: 12,
    borderRadius: 8,
  },
  eventCardGradient: {
    borderRadius: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  liveBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    overflow: 'hidden',
  },
  eventDate: {
    fontSize: 14,
    marginBottom: 2,
  },
  eventSport: {
    fontSize: 12,
    fontWeight: '500',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
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
  actionButtonWrapper: {
    flex: 1,
  },
  actionButton: {
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
