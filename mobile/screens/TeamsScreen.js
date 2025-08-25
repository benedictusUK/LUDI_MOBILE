import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function TeamsScreen() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('http://localhost:5000/api/teams');
        const json = await res.json();
        setTeams(json || []);
      } catch (e) {
        console.warn('Failed to fetch teams', e);
      }
    }
    fetchTeams();
  }, []);

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={teams}
      keyExtractor={(item) => String(item.id || item._id)}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.title}>{item.name}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No teams</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  item: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 20 },
});
