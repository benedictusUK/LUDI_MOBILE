import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('http://localhost:5000/api/events');
        const json = await res.json();
        setEvents(json || []);
      } catch (e) {
        console.warn('Failed to fetch events', e);
      }
    }
    fetchEvents();
  }, []);

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={events}
      keyExtractor={(item) => String(item.id || item._id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => navigation.navigate('EventDetails', { id: item.id || item._id })}
        >
          <Text style={styles.title}>{item.name || item.title}</Text>
          {item.date && <Text>{item.date}</Text>}
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No events</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  item: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 20 },
});
