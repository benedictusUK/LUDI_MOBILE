import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../contexts/DashboardDataContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { homePalette, useBrandTypography } from '../components/home/brand';
import NextUpStack from '../components/home/NextUpStack';
import LoadingScreen from '../components/LoadingScreen';

export default function MatchNightHomeScreen() {
  const { user, apiRequest } = useAuth();
  const { data, loading, error, reload } = useDashboardData();
  const { unreadCount, updateUnreadCount } = useNotifications();
  const { isDark } = useTheme();
  const palette = homePalette(isDark);
  const typography = useBrandTypography();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const firstFocus = useRef(true);
  const retry = useCallback(() => { reload().catch(() => {}); }, [reload]);
  // Returning from voting/payment screens must refresh the actual receipts.
  // The startup provider already fetched the first snapshot; don't duplicate it.
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else retry();
    const timer = setInterval(retry, 60000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') retry(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [retry]));
  useEffect(() => {
    let current = true;
    apiRequest('/api/notifications').then(async response => {
      if (!response.ok) return;
      const notifications = await response.json();
      if (current && Array.isArray(notifications)) updateUnreadCount(notifications.filter(item => !item.isRead).length);
    }).catch(() => {});
    return () => { current = false; };
  }, [user?.id, apiRequest, updateUnreadCount]);
  if (!data) return <LoadingScreen />;
  const body = style => [typography.body, style];
  const display = style => [typography.display, style];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const profileComplete = user?.username && user?.dateOfBirth && user?.postcode && user?.gender;
  const events = data.upcomingEvents || [];
  const openRoot = (name, params) => navigation.getParent()?.navigate(name, params);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: palette.background }]} testID="match-night-home">
      <View style={[styles.header, { borderBottomColor: palette.border }, Platform.OS === 'web' && { paddingTop: Math.max(0, 67 - insets.top) }]}>
        <View style={styles.logoPlate}><Image source={require('../assets/images/ludi-brand-logo.png')} resizeMode="contain" accessibilityLabel="LUDI logo" testID="signed-in-header-logo" style={styles.logo} /></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Notifications, ${unreadCount} unread`}
          style={[styles.notify, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => openRoot('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={palette.text} />
          {unreadCount > 0 && <View style={styles.badge}><Text style={body(styles.badgeText)}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={retry} tintColor={palette.mint} />}>
        {error && <TouchableOpacity accessibilityRole="button" onPress={retry} style={styles.error}>
          <Text style={body({ color: '#ffe09b', fontSize: 13 })}>{error} Tap to retry.</Text>
        </TouchableOpacity>}
        {typography.error && <Text style={body({ color: palette.muted, marginBottom: 12 })}>Brand fonts could not load. System text is being used.</Text>}
        <Text style={body({ color: palette.mint, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 })}>YOUR COMMUNITY, IN PLAY</Text>
        <Text style={display({ color: palette.text, fontSize: 34, marginTop: 5 })}>{greeting}, <Text style={{ color: palette.blue }}>{user?.firstName || user?.username || 'there'}.</Text></Text>
        <Text style={body({ color: palette.muted, fontSize: 12, marginTop: 6 })}>Your next game, vote and payment at a glance.</Text>
        {!profileComplete && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Profile')}
          style={[styles.profilePrompt, { backgroundColor: palette.surface, borderColor: palette.mint }]}>
          <Text style={body({ color: palette.text, fontSize: 14, fontWeight: '700' })}>Complete your profile</Text>
          <Text style={body({ color: palette.muted, fontSize: 12, marginTop: 4 })}>Finish setting up your sporting community profile.</Text>
        </TouchableOpacity>}
        <View style={styles.stats}>
          {[['My teams', data.stats?.teamsCount || 0, 'Teams'], ['Events', data.stats?.eventsCount || 0, 'Events']].map(([label, count, route]) => (
            <TouchableOpacity key={route} accessibilityRole="button" onPress={() => navigation.navigate(route)}
              style={[styles.stat, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={display({ color: palette.mint, fontSize: 21, lineHeight: 24 })}>{count}</Text>
              <Text style={body({ color: palette.muted, fontSize: 10, lineHeight: 12, marginTop: 2 })}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <NextUpStack events={events} palette={palette} onEvent={id => openRoot('EventDetails', { id })} onViewAll={() => navigation.navigate('Events')} onRetry={retry} />
        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View><Text style={display({ color: palette.text, fontSize: 24 })}>YOUR TEAMS</Text>
              <Text style={body({ color: palette.muted, fontSize: 11, marginTop: 3 })}>Your people, ready to play.</Text></View>
            <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Teams')} style={styles.link}><Text style={body({ color: palette.mint, fontSize: 14 })}>See all</Text></TouchableOpacity>
          </View>
          {(data.recentTeams || []).map(team => (
            <TouchableOpacity key={team.id} accessibilityRole="button" onPress={() => openRoot('TeamDetails', { teamId: team.id })}
              style={[styles.teamRow, { borderTopColor: palette.border }]}>
              <View style={[styles.teamAvatar, { backgroundColor: team.color || '#1d5183' }]}>
                <Ionicons name="people-outline" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}><Text style={body({ color: palette.text, fontSize: 14, fontWeight: '700' })}>{team.name}</Text>
                <Text style={body({ color: palette.muted, fontSize: 12, marginTop: 4 })}>{team.sports?.join(', ') || 'Your sporting community'}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </TouchableOpacity>
          ))}
          {!data.recentTeams?.length && <Text style={body({ color: palette.muted, paddingVertical: 16 })}>No teams yet. Find a community or create your own.</Text>}
        </View>
        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={display({ color: palette.text, fontSize: 24 })}>MAKE IT HAPPEN</Text>
          <View style={styles.actions}>
            {[['Create team', 'CreateTeam', 'people-outline'], ['Create event', 'CreateEvent', 'calendar-outline']].map(([label, route, icon]) => (
              <TouchableOpacity key={route} accessibilityRole="button" onPress={() => openRoot(route)}
                style={[styles.create, { borderColor: palette.border }]}>
                <Ionicons name={icon} size={18} color={palette.mint} /><Text style={body({ color: palette.text, fontSize: 12, fontWeight: '700' })}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  logoPlate: { width: 78, height: 50, borderRadius: 10, backgroundColor: '#0d2036' }, logo: { width: '100%', height: '100%' },
  notify: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, borderRadius: 12, backgroundColor: '#42e6b5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#06231e', fontSize: 10, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  profilePrompt: { padding: 14, marginTop: 14, borderLeftWidth: 3, borderRadius: 12 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 12 },
  stat: { flex: 1, padding: 8, borderWidth: 1, borderRadius: 12 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  link: { minHeight: 44, justifyContent: 'center', paddingLeft: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 15 },
  teamAvatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  create: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  error: { backgroundColor: '#543c20', borderRadius: 12, padding: 14, marginBottom: 14 },
});
