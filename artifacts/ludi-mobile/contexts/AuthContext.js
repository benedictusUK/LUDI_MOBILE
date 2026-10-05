import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from '../lib/tokenStore';
import { API_BASE_URL } from '../lib/apiConfig';
import { unregisterPushForLogout } from '../lib/pushDevice';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const TOKEN_KEY = 'userToken';
const USER_ID_KEY = 'userId';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    setIsLoading(true);
    setAuthError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedUserId = await SecureStore.getItemAsync(USER_ID_KEY);

      if (storedToken && storedUserId) {
        setToken(storedToken);

        const response = await fetch(`${API_BASE_URL}/api/auth/user`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          if (!userData?.id) throw new Error('Invalid account response');
          setUser(userData);
        } else if (response.status === 401 || response.status === 403) {
          await signOut();
        } else {
          throw new Error('Account lookup failed');
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error checking auth state:', error);
      // A database/network failure is not an expired session. Keep the saved
      // credentials and offer retry rather than silently opening login.
      setAuthError('We couldn’t load your account. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const signIn = async (userData, authToken) => {
    try {
      setAuthError(null);
      setUser(userData);
      setToken(authToken);
      await SecureStore.setItemAsync(TOKEN_KEY, authToken);
      await SecureStore.setItemAsync(USER_ID_KEY, userData.id);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      try {
        await unregisterPushForLogout(token);
      } catch {
        Alert.alert(
          'Could not disconnect iPhone alerts',
          'You will still be logged out. LUDI could not remove this phone’s notification registration. To stop alerts while offline, turn off notifications for LUDI in iPhone Settings.',
        );
      }
      setUser(null);
      setAuthError(null);
      setToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_ID_KEY);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateUser = (updatedUserData) => {
    setUser(prev => ({ ...prev, ...updatedUserData }));
  };

  const apiRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000);

      const fetchOptions = {
        method,
        headers,
        signal: controller.signal,
      };

      if (options.body && method !== 'GET') {
        fetchOptions.body = options.body;
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (response.status === 401) {
        await signOut();
        throw new Error('Authentication required');
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your internet connection');
      }
      throw error;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    authError,
    retryAuth: checkAuthState,
    signIn,
    signOut,
    logout: signOut,
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
