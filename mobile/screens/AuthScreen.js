import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export default function AuthScreen({ onAuthSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(null);
  const { signIn } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setIsAppleAvailable(available);
      })
      .catch((error) => {
        console.error('Apple Sign-In availability check failed:', error);
        if (mounted) setIsAppleAvailable(false);
      });

    return () => { mounted = false; };
  }, []);

  // Handle Google Sign In - currently not supported in Expo Go
  const handleGoogleSignIn = async () => {
    Alert.alert(
      'Google Sign-In Not Available',
      'Google OAuth has technical limitations in Expo Go. Please use:\n\n• Replit Sign-In\n• Apple Sign-In (on iOS)\n\nGoogle Sign-In will be available when the app is published as a standalone app.',
      [{ text: 'OK' }]
    );
  };

  const handleGoogleCodeExchange = async (code, redirectUri) => {
    try {
      // Send code to backend to exchange for token and user info
      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/google/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await signIn(data.user, data.token);
      } else {
        console.error('Code exchange failed:', data);
        Alert.alert('Authentication Failed', data.message || 'Please try again');
      }
    } catch (error) {
      console.error('Code exchange error:', error);
      Alert.alert('Authentication Error', 'Unable to complete sign in');
    }
  };

  const handleGoogleAuthSuccess = async (accessToken) => {
    try {
      // Get user info from Google
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }
      
      const userInfo = await userInfoResponse.json();

      // Send to our backend to create/update user
      const backendResponse = await fetch(`${API_BASE_URL}/api/auth/mobile/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          user_info: userInfo
        }),
      });

      const data = await backendResponse.json();
      
      if (backendResponse.ok) {
        await signIn(data.user, data.token);
      } else {
        Alert.alert('Authentication Failed', data.message || 'Please try again');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Authentication Error', 'Unable to complete sign in');
    }
  };

  const handleAppleSignIn = async () => {
    if (isLoading || !isAppleAvailable) return;
    try {
      setIsLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token. Please try again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          user_info: {
            email: credential.email,
            fullName: credential.fullName
          }
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Use signIn from AuthContext to properly update auth state
        await signIn(data.user, data.token);
      } else {
        Alert.alert('Authentication Failed', data.message || 'Please try again');
      }
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        // User canceled the sign-in flow
        return;
      }
      console.error('Apple auth error:', error);
      Alert.alert('Apple Sign-In Failed', error.message || 'Unable to sign in with Apple');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplitSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Open web browser for Replit OAuth
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'ludi',
        path: 'auth/replit/callback'
      });
      
      const authUrl = `${API_BASE_URL}/api/mobile/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      const result = await AuthSession.startAsync({
        authUrl,
        returnUrl: redirectUri,
      });

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        const userId = url.searchParams.get('user_id');
        
        if (token && userId) {
          // Fetch user data
          const userResponse = await fetch(`${API_BASE_URL}/api/auth/user`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            // Use signIn from AuthContext to properly update auth state
            await signIn(userData, token);
          }
        } else {
          Alert.alert('Authentication Failed', 'Unable to complete sign in');
        }
      }
    } catch (error) {
      console.error('Replit auth error:', error);
      Alert.alert('Authentication Error', 'Unable to sign in with Replit');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🏆</Text>
          </View>
          <Text style={styles.title}>Welcome to LUDI</Text>
          <Text style={styles.subtitle}>Connect, Play, Compete</Text>
        </View>

        <View style={styles.authButtons}>
          {/* Replit Sign In */}
          <TouchableOpacity
            style={[styles.authButton, styles.replitButton]}
            onPress={handleReplitSignIn}
            disabled={isLoading}
          >
            <Text style={styles.authButtonText}>Continue with Replit</Text>
          </TouchableOpacity>

          {/* Google Sign In - Disabled in Expo Go */}
          <TouchableOpacity
            style={[styles.authButton, styles.googleButton, styles.disabledButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.authButtonText, styles.googleButtonText]}>Continue with Google (Limited)</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && isAppleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}
          {Platform.OS === 'ios' && isAppleAvailable === false && (
            <Text style={styles.appleUnavailableText}>
              Apple Sign-In is unavailable on this device. If you use Expo Go, update it to the latest version.
            </Text>
          )}
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  authButtons: {
    gap: 16,
  },
  authButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replitButton: {
    backgroundColor: '#10b981',
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  googleButtonText: {
    color: '#374151',
  },
  disabledButton: {
    opacity: 0.6,
  },
  appleButton: {
    height: 50,
  },
  appleUnavailableText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 24,
    lineHeight: 16,
  },
});