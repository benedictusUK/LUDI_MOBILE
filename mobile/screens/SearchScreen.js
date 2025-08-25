import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';

export default function SearchScreen() {
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('10');
  const [results, setResults] = useState([]);

  async function handleSearch() {
    try {
      const params = new URLSearchParams({ postcode, radius });
      const res = await fetch(`http://localhost:5000/api/flare-events?${params}`);
      const json = await res.json();
      setResults(json || []);
    } catch (e) {
      console.warn('Failed to search events', e);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Postcode"
        value={postcode}
        onChangeText={setPostcode}
      />
      <TextInput
        style={styles.input}
        placeholder="Radius"
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
      />
      <Button title="Search" onPress={handleSearch} />
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(item) => String(item.id || item._id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>{item.name || item.title}</Text>
            {item.date && <Text>{item.date}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No results</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8, borderRadius: 4 },
  list: { paddingTop: 16 },
  item: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 20 },
});
