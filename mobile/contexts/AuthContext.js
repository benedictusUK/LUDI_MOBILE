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
      const storedToken = await AsyncStorage.getItem('userToken');
      const storedUserId = await AsyncStorage.getItem('userId');

      if (storedToken && storedUserId) {
        setToken(storedToken);
        
        // Verify token is still valid and get user data
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Token is invalid, clear storage
          await signOut();
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      await signOut();
      throw new Error('Authentication required');
    }

    return response;
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