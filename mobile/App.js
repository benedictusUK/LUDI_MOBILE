import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StripeProvider } from '@stripe/stripe-react-native';
import HomeScreen from './screens/HomeScreen';
import EventsScreen from './screens/EventsScreen';
import TeamsScreen from './screens/TeamsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import SearchScreen from './screens/SearchScreen';
import WebAppScreen from './screens/WebAppScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import PaymentScreen from './screens/PaymentScreen';
import { usePushNotifications } from './hooks/usePushNotifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Teams" component={TeamsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Web" component={WebAppScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  usePushNotifications();

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event Details' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </StripeProvider>
  );
}
