import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';
import { signInWithGoogle } from '../lib/googleSignIn';

// Login-scoped palette, sampled from the helmet artwork.
const palette = {
  background: '#08090B',
  surface: '#14151A',
  border: '#2E2A20',
  gold: '#D9A441',
  goldDeep: '#B8862B',
  text: '#F3E9D2',
  muted: '#A39C8A',
  onGold: '#14100A',
};

export default function AuthScreen() {
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

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result) return; // cancelled
      await signIn(result.user, result.token);
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert(
        'Google Sign-In Failed',
        error?.message || 'We could not sign you in with Google. Please try again.'
      );
    } finally {
      setIsLoading(false);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          user_info: {
            email: credential.email,
            fullName: credential.fullName,
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await signIn(data.user, data.token);
      } else {
        Alert.alert('Authentication Failed', data.message || 'Please try again');
      }
    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Apple auth error:', error);
      Alert.alert('Apple Sign-In Failed', error.message || 'Unable to sign in with Apple');
    } finally {
      setIsLoading(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.container} testID="auth-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWeb && { paddingTop: 67, paddingBottom: 34 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/images/ludi-login-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="LUDI Spartan helmet logo"
            testID="auth-logo"
          />
          <Text style={styles.title} accessibilityRole="header">LUDI</Text>
          <View style={styles.rule} />
          <Text style={styles.subtitle}>Don't just watch.</Text>
        </View>

        <View style={styles.authButtons}>
          <TouchableOpacity
            style={[styles.authButton, styles.googleButton, isLoading && styles.disabledButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            testID="google-sign-in-button"
          >
            {isLoading ? (
              <ActivityIndicator color={palette.onGold} testID="auth-loading-indicator" />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && isAppleAvailable && (
            <View
              style={[styles.appleWrap, isLoading && styles.disabledButton]}
              pointerEvents={isLoading ? 'none' : 'auto'}
            >
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                testID="apple-sign-in-button"
              />
            </View>
          )}
          {Platform.OS === 'ios' && isAppleAvailable === false && (
            <Text style={styles.appleUnavailableText} testID="apple-unavailable-text">
              Apple Sign-In is unavailable in this iOS app. If Expo Go is up to date, it may not include the native Apple module. An iOS development build with Apple Sign-In enabled is needed to test it reliably.
            </Text>
          )}
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 4,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 12,
    paddingLeft: 12,
    color: palette.gold,
  },
  rule: {
    width: 48,
    height: 2,
    backgroundColor: palette.goldDeep,
    marginVertical: 14,
  },
  subtitle: {
    fontSize: 17,
    color: palette.text,
    fontWeight: '500',
    letterSpacing: 1,
  },
  authButtons: {
    gap: 14,
  },
  authButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: palette.gold,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.onGold,
  },
  disabledButton: {
    opacity: 0.6,
  },
  appleWrap: {
    borderRadius: 12,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  appleUnavailableText: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    color: palette.muted,
    marginTop: 28,
    lineHeight: 17,
  },
});
