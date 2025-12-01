import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
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
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', or 'system'
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
  const colors = {
    // Background colors
    background: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    cardSecondary: isDark ? '#334155' : '#f1f5f9',
    
    // Text colors
    text: isDark ? '#f1f5f9' : '#1e293b',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    textTertiary: isDark ? '#64748b' : '#94a3b8',
    
    // Border colors
    border: isDark ? '#334155' : '#e2e8f0',
    borderLight: isDark ? '#1e293b' : '#f1f5f9',
    
    // Primary colors (blue-green gradient)
    primary: '#3b82f6',
    primaryGreen: '#10b981',
    
    // Status colors
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    
    // Input colors
    inputBackground: isDark ? '#1e293b' : '#ffffff',
    inputBorder: isDark ? '#334155' : '#e2e8f0',
    inputText: isDark ? '#f1f5f9' : '#1e293b',
    inputPlaceholder: isDark ? '#64748b' : '#94a3b8',
    
    // Button colors
    buttonText: '#ffffff',
    buttonSecondary: isDark ? '#334155' : '#e2e8f0',
    buttonSecondaryText: isDark ? '#f1f5f9' : '#64748b',
    
    // Icon colors
    icon: isDark ? '#94a3b8' : '#64748b',
    iconActive: isDark ? '#10b981' : '#3b82f6',
    
    // Special states
    disabled: isDark ? '#475569' : '#cbd5e1',
    shadow: isDark ? '#000000' : '#000000',
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
