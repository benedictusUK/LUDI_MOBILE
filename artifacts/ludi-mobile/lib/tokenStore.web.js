import AsyncStorage from '@react-native-async-storage/async-storage';

// Browser preview has no native SecureStore module. Native builds use tokenStore.js.
export const getItemAsync = (key) => AsyncStorage.getItem(key);
export const setItemAsync = (key, value) => AsyncStorage.setItem(key, value);
export const deleteItemAsync = (key) => AsyncStorage.removeItem(key);