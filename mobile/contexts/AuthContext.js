import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('[AuthContext] Checking auth state...');
      const storedToken = await AsyncStorage.getItem('userToken');
      const storedUserId = await AsyncStorage.getItem('userId');

      if (storedToken && storedUserId) {
        console.log('[AuthContext] Found stored token, verifying...');
        setToken(storedToken);
        
        // Verify token is still valid and get user data
        const response = await fetch(`${API_BASE_URL}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        console.log('[AuthContext] Token verification response:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('[AuthContext] User authenticated:', userData.id);
          setUser(userData);
        } else {
          // Token is invalid, clear storage
          console.log('[AuthContext] Token invalid, clearing storage');
          await signOut();
        }
      } else {
        console.log('[AuthContext] No stored token found');
      }
    } catch (error) {
      console.error('[AuthContext] Error checking auth state:', error);
    } finally {
      console.log('[AuthContext] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const signIn = async (userData, authToken) => {
    try {
      setUser(userData);
      setToken(authToken);
      await AsyncStorage.setItem('userToken', authToken);
      await AsyncStorage.setItem('userId', userData.id);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setToken(null);
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userId');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateUser = (updatedUserData) => {
    setUser(prev => ({ ...prev, ...updatedUserData }));
  };

  // API request helper with authentication
  const apiRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    console.log('[apiRequest] Making request to:', endpoint, options.method || 'GET');

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[apiRequest] Response status:', response.status);

      if (response.status === 401) {
        // Token expired or invalid
        await signOut();
        throw new Error('Authentication required');
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[apiRequest] Request timeout after 30s:', endpoint);
        throw new Error('Request timeout - please check your internet connection');
      }
      console.error('[apiRequest] Request failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    signIn,
    signOut,
    updateUser,
    apiRequest,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}