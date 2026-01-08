import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { SafeStripeProvider } from './components/SafeStripeProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToast from './components/NotificationToast';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import EventsScreen from './screens/EventsScreen';
import TeamsScreen from './screens/TeamsScreen';
import TeamDetailsScreen from './screens/TeamDetailsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';
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
import LoadingScreen from './components/LoadingScreen';
import { usePushNotifications } from './hooks/usePushNotifications';
import { View, Text, StyleSheet, AppRegistry } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STRIPE_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.stripePublishableKey || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
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
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, loading: themeLoading } = useTheme();
  const [showLogoReveal, setShowLogoReveal] = useState(false);
  const [hasShownReveal, setHasShownReveal] = useState(false);
  usePushNotifications();

  // Check if user has seen the logo reveal animation on first load
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      AsyncStorage.getItem('ludi-logo-revealed').then(hasRevealed => {
        if (!hasRevealed) {
          setShowLogoReveal(true);
        } else {
          setHasShownReveal(true);
        }
      });
    }
  }, [isAuthenticated, isLoading]);

  const handleLogoRevealComplete = () => {
    setShowLogoReveal(false);
    setHasShownReveal(true);
    AsyncStorage.setItem('ludi-logo-revealed', 'true');
  };

  if (isLoading || themeLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // Show logo reveal animation on first app load
  if (showLogoReveal && !hasShownReveal) {
    return <LoadingScreen onComplete={handleLogoRevealComplete} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TeamDetails" component={TeamDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TeamSearch" component={TeamSearchScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditEvent" component={EditEventScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event Details' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
          <Stack.Screen name="PaymentAuthorization" component={PaymentAuthorizationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentCollection" component={PaymentCollectionScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      <NotificationToast />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <SafeStripeProvider 
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.com.ludi.app"
            urlScheme="ludi"
          >
            <AppContent />
          </SafeStripeProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
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

// Register the app
AppRegistry.registerComponent('main', () => App);
