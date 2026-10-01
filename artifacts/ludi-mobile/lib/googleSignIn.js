import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  completeGoogleMobileSignIn,
  getGoogleMobileSignInConfig,
  setBaseUrl,
} from '@workspace/api-client-react';
import { API_BASE_URL } from './apiConfig';

setBaseUrl(API_BASE_URL);
WebBrowser.maybeCompleteAuthSession();

function getRedirectUri() {
  if (Platform.OS === 'web') {
    // Retain the artifact prefix when the web preview is mounted at /ludi-mobile/.
    const base = new URL(globalThis.location.href);
    base.search = '';
    base.hash = '';
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return new URL('auth/google/callback', base).href;
  }
  return AuthSession.makeRedirectUri({
    scheme: 'ludi-mobile',
    path: 'auth/google/callback',
    native: 'ludi-mobile:///auth/google/callback',
  });
}

async function prepareRequest() {
  const redirectUri = getRedirectUri();
  const options = {
    clientId: 'ludi-mobile-handoff',
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  };
  // AuthSession creates cryptographically random state. Combine three of its
  // nonces for this app-side return check, independently of the PKCE verifier.
  const state = Array.from(
    { length: 3 },
    () => new AuthSession.AuthRequest(options).state,
  ).join('');
  const request = new AuthSession.AuthRequest({ ...options, state });
  const config = await request.getAuthRequestConfigAsync();
  return { request, config, redirectUri };
}

// Prepare before a tap so web authentication can open a popup while the user's
// browser activation is still active. Never retain a rejected startup promise.
let preparedRequest = prepareRequest().catch((error) => ({ error }));
let preparedConfig = getGoogleMobileSignInConfig().catch(() => null);
let signingIn = false;

const callbackErrors = {
  google_unavailable: 'Google sign-in is not configured yet.',
  auth_expired: 'Your sign-in session expired. Please try again.',
  auth_failed: 'Google could not complete sign-in. Please try again.',
};

export async function signInWithGoogle() {
  if (signingIn) return null;
  signingIn = true;
  try {
    let readiness = await preparedConfig;
    // Recheck an unavailable configuration: the backend may have been
    // republished since the login screen was opened.
    if (!readiness?.enabled) readiness = await getGoogleMobileSignInConfig();
    if (!readiness.enabled) {
      throw new Error('Google sign-in needs its server configuration completed before you can continue.');
    }

    const prepared = await preparedRequest;
    if (prepared.error) throw prepared.error;
    const { request, config, redirectUri } = prepared;
    const authUrl = new URL(`${API_BASE_URL}/api/auth/mobile/google/start`);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('code_challenge', config.codeChallenge);
    authUrl.searchParams.set('state', config.state);

    const result = await WebBrowser.openAuthSessionAsync(authUrl.href, redirectUri);
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in did not return to LUDI. Please try again.');
    }

    const callback = new URL(result.url);
    const expected = new URL(redirectUri);
    if (
      callback.protocol !== expected.protocol ||
      callback.host !== expected.host ||
      callback.pathname !== expected.pathname ||
      callback.searchParams.get('state') !== config.state
    ) {
      throw new Error('The Google sign-in response could not be verified. Please try again.');
    }
    const error = callback.searchParams.get('error');
    if (error === 'cancelled') return null;
    if (error) throw new Error(callbackErrors[error] || 'Google sign-in failed. Please try again.');

    const ticket = callback.searchParams.get('ticket');
    if (!ticket || !request.codeVerifier) {
      throw new Error('Google did not return a complete sign-in response.');
    }
    const data = await completeGoogleMobileSignIn({
      ticket,
      code_verifier: request.codeVerifier,
    });
    if (!data.success || !data.user?.id || !data.token) {
      throw new Error('Google sign-in returned an incomplete account response.');
    }
    return { user: data.user, token: data.token };
  } catch (error) {
    if (error?.data?.message) throw new Error(error.data.message);
    throw error;
  } finally {
    signingIn = false;
    preparedRequest = prepareRequest().catch((error) => ({ error }));
    preparedConfig = getGoogleMobileSignInConfig().catch(() => null);
  }
}