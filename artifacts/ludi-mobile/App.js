import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeStripeProvider } from './components/SafeStripeProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DashboardDataProvider, useDashboardData } from './contexts/DashboardDataContext';
import NotificationToast from './components/NotificationToast';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/MatchNightHomeScreen';
import FloatingTabBar from './components/FloatingTabBar';
import { useFonts } from 'expo-font';
import { brandFonts, BrandTypographyContext } from './components/home/brand';
import EventsScreen from './screens/EventsScreen';
import TeamsScreen from './screens/TeamsScreen';
import TeamDetailsScreen from './screens/TeamDetailsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SuperAdminScreen from './screens/SuperAdminScreen';
import SearchScreen from './screens/SearchScreen';
import CreateTeamScreen from './screens/CreateTeamScreen';
import TeamSearchScreen from './screens/TeamSearchScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import EditEventScreen from './screens/EditEventScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import PaymentScreen from './screens/PaymentScreen';
import PaymentAuthorizationScreen from './screens/PaymentAuthorizationScreen';
import PaymentMethodsScreen from './screens/PaymentMethodsScreen';
import PaymentCollectionScreen from './screens/PaymentCollectionScreen';
import BlockedMembersScreen from './screens/BlockedMembersScreen';
import LoadingScreen from './components/LoadingScreen';
import { startupPhase } from './lib/startup';
import { usePushNotifications, PushNotificationsProvider } from './hooks/usePushNotifications';
import { navigationRef } from './lib/navigation';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { registerRootComponent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Events':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Search':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Teams':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <Ionicons 
              name={iconName} 
              size={size} 
              color={color}
            />
          );
        },
        tabBarActiveTintColor: colors.primaryGreen,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Events" 
        component={EventsScreen}
        options={{
          tabBarLabel: 'Events',
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen 
        name="Teams" 
        component={TeamsScreen}
        options={{
          tabBarLabel: 'Teams',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, authError, retryAuth } = useAuth();
  const { isReady: dashboardReady, error: dashboardError, reload } = useDashboardData();
  const { colors, loading: themeLoading } = useTheme();
  const pushNotifications = usePushNotifications();
  const [fontsLoaded, fontError] = useFonts(brandFonts);
  const [animationComplete, setAnimationComplete] = React.useState(false);
  const phase = startupPhase({
    animationComplete, authLoading: isLoading, authError, themeLoading,
    fontsReady: fontsLoaded || !!fontError, isAuthenticated,
    dashboardReady, dashboardError,
  });

  if (phase === 'animation' || phase === 'waiting') {
    return <LoadingScreen playAnimation={phase === 'animation'} onComplete={() => setAnimationComplete(true)} />;
  }

  if (phase === 'login') {
    return <BrandTypographyContext.Provider value={{ loaded: fontsLoaded, error: fontError }}><AuthScreen onAuthSuccess={() => {}} /></BrandTypographyContext.Provider>;
  }

  if (phase === 'error') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.loadingText, { color: colors.text, textAlign: 'center' }]}>
          {authError || dashboardError || 'LUDI couldn’t finish loading. Please try again.'}
        </Text>
        {(authError || dashboardError) && (
          <TouchableOpacity accessibilityRole="button" onPress={() => authError ? retryAuth() : reload().catch(() => {})}
            style={{ backgroundColor: colors.primaryGreen, minHeight: 44, padding: 14, borderRadius: 12, marginTop: 20 }}>
            <Text style={{ color: colors.buttonText, fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <BrandTypographyContext.Provider value={{ loaded: fontsLoaded, error: fontError }}>
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} onReady={pushNotifications.openPendingNotification}>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, headerTitleStyle: fontsLoaded ? { fontFamily: 'LudiBody', color: colors.text } : { color: colors.text }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SuperAdmin" component={SuperAdminScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TeamDetails" component={TeamDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TeamHistory" component={EventsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TeamSearch" component={TeamSearchScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditEvent" component={EditEventScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event Details' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
          <Stack.Screen name="PaymentAuthorization" component={PaymentAuthorizationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentCollection" component={PaymentCollectionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BlockedMembers" component={BlockedMembersScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      <NotificationToast />
    </View>
    </BrandTypographyContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
    <AuthProvider>
      <PushNotificationsProvider>
            <NotificationProvider>
              <SafeStripeProvider
                publishableKey={STRIPE_PUBLISHABLE_KEY}
                urlScheme="ludi-mobile"
              >
                <DashboardDataProvider>
                  <AppContent />
                </DashboardDataProvider>
              </SafeStripeProvider>
            </NotificationProvider>
      </PushNotificationsProvider>
    </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 18,
    color: '#64748b',
  },
});

// Register the same root for Expo Go, standalone iOS/Android, and web preview.
registerRootComponent(App);
