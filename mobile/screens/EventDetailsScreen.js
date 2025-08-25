import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { calculateTotalAmount } from '../lib/paymentUtils';

export default function EventDetailsScreen({ route }) {
  const { id } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [holdAmount, setHoldAmount] = useState(0);
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventRes, userRes, attendanceRes, chargesRes] = await Promise.all([
          fetch(`http://localhost:5000/api/events/${id}`, { credentials: 'include' }),
          fetch('http://localhost:5000/api/auth/user', { credentials: 'include' }),
          fetch(`http://localhost:5000/api/events/${id}/attendance`, { credentials: 'include' }),
          fetch('http://localhost:5000/api/platform-charges', { credentials: 'include' })
        ]);
        const eventJson = await eventRes.json();
        const userJson = await userRes.json();
        const attendanceJson = await attendanceRes.json();
        const platformCharges = await chargesRes.json();
        setEvent(eventJson);
        setUser(userJson);
        setAttendance(attendanceJson);

        if (Array.isArray(attendanceJson)) {
          const attending = attendanceJson.some(a => a.userId === userJson.id && a.status === 'attending');
          setIsAttending(attending);
        }
        if (userJson.id === eventJson.createdById) {
          setIsOrganiser(true);
        }

        const calc = calculateTotalAmount(eventJson.maxPlayerPayment || 0, platformCharges);
        setHoldAmount(calc.total);
      } catch (e) {
        console.warn('Failed to load event details', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleAttend = () => {
    navigation.navigate('Payment', {
      eventId: id,
      baseAmount: event.maxPlayerPayment,
      description: `Authorize payment for ${event.name}`,
      onSuccess: () => setIsAttending(true)
    });
  };

  const handleUnvote = async () => {
    try {
      await fetch(`http://localhost:5000/api/events/${id}/vote`, { method: 'DELETE', credentials: 'include' });
      setIsAttending(false);
      alert('You have been removed and any holds cancelled');
    } catch (e) {
      console.warn('Failed to unvote', e);
    }
  };

  const handleCollectPayments = async () => {
    try {
      const attendeeIds = attendance.filter(a => a.status === 'attending').map(a => a.userId);
      const res = await fetch(`http://localhost:5000/api/events/${id}/collect-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organiserId: user.id, venueCost: event.venueCost || '0', attendeeIds })
      });
      const data = await res.json();
      alert(data.message || 'Payment collection processed');
    } catch (e) {
      console.warn('Failed to collect payments', e);
    }
  };

  if (loading || !event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{event.name || event.title}</Text>
      {event.date && <Text>{event.date}</Text>}
      {event.description && <Text style={styles.desc}>{event.description}</Text>}
      {event.paymentRequired && (
        <Text style={styles.desc}>Hold including fees: £{holdAmount.toFixed(2)}</Text>
      )}
      {!isAttending && event.paymentRequired && (
        <Button title="Attend" onPress={handleAttend} />
      )}
      {isAttending && (
        <Button title="Unvote" onPress={handleUnvote} />
      )}
      {isOrganiser && event.paymentRequired && (
        <Button title="Collect Payments" onPress={handleCollectPayments} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  desc: { marginTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
