import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

export default function NotificationsScreen() {
  const [notification, setNotification] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(setNotification);
    return () => subscription.remove();
  }, []);

  const paymentData = notification?.request?.content?.data?.payment;

  return (
    <View style={styles.container}>
      {notification ? (
        <>
          <Text>{notification.request.content.body}</Text>
          {paymentData && (
            <Button
              title="Authorize Payment"
              onPress={() =>
                navigation.navigate('Payment', {
                  eventId: paymentData.eventId,
                  amount: paymentData.amount,
                  description: paymentData.description,
                })
              }
            />
          )}
        </>
      ) : (
        <Text style={styles.empty}>No notifications yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#666' },
});
