import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '../lib/stripe';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function PaymentScreen({ route }) {
  const { eventId, amount = 0, description = 'Event Payment' } = route.params || {};
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { apiRequest } = useAuth();
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [event, setEvent] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);

  useEffect(() => {
    initializePayment();
  }, [eventId]);

  const initializePayment = async () => {
    try {
      setLoading(true);

      // Fetch event details
      const eventResponse = await apiRequest(`/api/events/${eventId}`);
      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEvent(eventData);
      }

      // Create payment intent
      const paymentResponse = await apiRequest('/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          amount: amount || 10, // Default amount if not provided
        }),
      });

      if (paymentResponse.ok) {
        const { clientSecret, totalAmount, breakdown } = await paymentResponse.json();
        
        setPaymentBreakdown(breakdown || [
          { name: 'Event Fee', amount: amount || 10 },
          { name: 'Platform Fee', amount: 0.50 },
        ]);

        const { error } = await initPaymentSheet({
          merchantDisplayName: 'LUDI Sports',
          paymentIntentClientSecret: clientSecret,
          style: 'alwaysDark',
          googlePay: {
            merchantCountryCode: 'GB',
            testEnv: true,
          },
          applePay: {
            merchantCountryCode: 'GB',
          },
        });

        if (!error) {
          setReady(true);
        } else {
          console.error('Payment sheet init failed:', error);
          Alert.alert('Error', 'Failed to initialize payment');
        }
      } else {
        const error = await paymentResponse.json();
        Alert.alert('Error', error.message || 'Failed to create payment');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', 'Unable to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        console.error('Payment failed:', error);
        Alert.alert('Payment Failed', error.message);
      } else {
        // Payment successful, confirm attendance
        try {
          const attendanceResponse = await apiRequest(`/api/events/${eventId}/attendance`, {
            method: 'POST',
            body: JSON.stringify({ status: 'attending' }),
          });

          if (attendanceResponse.ok) {
            Alert.alert(
              'Payment Successful! 🎉',
              'Your payment has been processed and attendance confirmed.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]
            );
          } else {
            Alert.alert(
              'Payment Processed',
              'Payment successful, but failed to confirm attendance. Please try again.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]
            );
          }
        } catch (attendanceError) {
          console.error('Attendance confirmation error:', attendanceError);
          Alert.alert(
            'Payment Processed',
            'Payment successful, but failed to confirm attendance.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Payment presentation error:', error);
      Alert.alert('Error', 'Unable to process payment');
    }
  };

  const getTotalAmount = () => {
    return paymentBreakdown.reduce((total, item) => total + item.amount, 0);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Preparing payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Payment not available</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={initializePayment}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.placeholder} />
        </View>

        {event && (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.name}</Text>
            <Text style={styles.eventDate}>
              {new Date(event.date).toLocaleDateString()} at{' '}
              {new Date(event.date).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {event.location && (
              <Text style={styles.eventLocation}>📍 {event.location}</Text>
            )}
            <View style={styles.sportBadge}>
              <Text style={styles.sportText}>{event.sport}</Text>
            </View>
          </View>
        )}

        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Breakdown</Text>
          
          {paymentBreakdown.map((item, index) => (
            <View key={index} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.name}</Text>
              <Text style={styles.breakdownAmount}>£{item.amount.toFixed(2)}</Text>
            </View>
          ))}
          
          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>£{getTotalAmount().toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💳 Secure Payment</Text>
          <Text style={styles.infoText}>
            Your payment is processed securely by Stripe. We don't store your card details.
          </Text>
          <Text style={styles.infoText}>
            By proceeding, you authorize this payment and confirm your attendance at the event.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
        >
          <Text style={styles.payButtonText}>
            Pay £{getTotalAmount().toFixed(2)}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 60,
  },
  eventCard: {
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
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  sportBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  sportText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentCard: {
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
  paymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 16,
    color: '#374151',
  },
  breakdownAmount: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  infoCard: {
    backgroundColor: '#f0f9ff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
    marginBottom: 4,
  },
  payButton: {
    backgroundColor: '#10b981',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});