import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { homePalette } from '../components/home/brand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  // Default to dark; a previously saved light/dark/system choice still wins.
  const [themeMode, setThemeMode] = useState('dark'); // 'light', 'dark', or 'system'
  const [loading, setLoading] = useState(true);

  // Determine the actual theme to use
  const activeTheme = themeMode === 'system' ? systemColorScheme : themeMode;
  const isDark = activeTheme === 'dark';

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme_preference');
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference
  const changeTheme = async (newTheme) => {
    try {
      await AsyncStorage.setItem('theme_preference', newTheme);
      setThemeMode(newTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Theme colors
  const hp = homePalette(isDark);
  const colors = {
    background: hp.background,
    card: hp.surface,
    cardSecondary: isDark ? '#16324d' : '#e3eefb',
    text: hp.text,
    textSecondary: hp.muted,
    textTertiary: isDark ? '#8aa3b8' : '#6b8296',
    border: hp.border,
    borderLight: isDark ? '#1d3750' : '#dde9f3',
    primary: hp.mint,
    primaryGreen: hp.mint,
    success: hp.mint,
    error: isDark ? '#ff7a7a' : '#c93b3b',
    warning: isDark ? '#ffd27a' : '#a8660a',
    info: hp.blue,
    inputBackground: hp.surface,
    inputBorder: hp.border,
    inputText: hp.text,
    inputPlaceholder: isDark ? '#8aa3b8' : '#6b8296',
    buttonText: isDark ? '#06231e' : '#ffffff',
    buttonSecondary: isDark ? '#16324d' : '#e3eefb',
    buttonSecondaryText: hp.text,
    icon: hp.muted,
    iconActive: hp.mint,
    disabled: isDark ? '#3a566e' : '#b5c8d8',
    shadow: '#020b14',
    selectionBackground: isDark ? 'rgba(66,230,181,0.16)' : '#dff3ec',
    selectionText: hp.mint,
    overlay: isDark ? 'rgba(2,11,20,0.75)' : 'rgba(7,23,40,0.5)',
    primaryLight: isDark ? 'rgba(66,230,181,0.16)' : '#dff3ec',
  };

  const value = {
    themeMode,
    changeTheme,
    isDark,
    colors,
    loading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
