import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { calculateTotalAmount } from '../lib/paymentUtils';

export default function PaymentScreen({ route, navigation }) {
  const {
    eventId,
    baseAmount = 0,
    description = 'Authorize payment',
    onSuccess
  } = route.params || {};
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    async function initialize() {
      try {
        const chargesRes = await fetch('http://localhost:5000/api/platform-charges', { credentials: 'include' });
        const platformCharges = await chargesRes.json();
        const calc = calculateTotalAmount(baseAmount, platformCharges);
        setTotal(calc.total);
        setBreakdown(calc.breakdown);

        const res = await fetch(`http://localhost:5000/api/events/${eventId}/authorize-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ paymentMethodId: 'new-card', amount: calc.total })
        });
        const { clientSecret } = await res.json();
        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'LUDI'
        });
        if (!error) {
          setReady(true);
        } else {
          console.warn('Payment sheet init failed', error);
        }
      } catch (err) {
        console.warn('Failed to initialize payment', err);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, [baseAmount, eventId, initPaymentSheet]);

  const openSheet = async () => {
    const { error } = await presentPaymentSheet();
    if (error) {
      console.warn('Payment failed', error);
    } else {
      try {
        await fetch(`http://localhost:5000/api/events/${eventId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'attending' })
        });
        alert('Payment authorized and attendance confirmed');
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
        navigation.goBack();
      } catch (e) {
        console.warn('Failed to record attendance', e);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text>Payment unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{description}</Text>
      {breakdown.map((item, idx) => (
        <Text key={idx}>{`${item.name}: £${item.amount.toFixed(2)}`}</Text>
      ))}
      <Button title={`Authorize £${total.toFixed(2)}`} onPress={openSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, marginBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
