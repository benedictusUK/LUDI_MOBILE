import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getGoogleMobileCallbackUrl,
  isAllowedGoogleMobileRedirect,
  isAllowedMobileRedirect,
} from './mobileRedirect.ts';

test('standalone LUDI callback uses the exact triple-slash deep link', () => {
  assert.equal(isAllowedMobileRedirect('ludi-mobile:///auth/replit/callback'), true);
  assert.equal(isAllowedMobileRedirect('ludi-mobile://auth/replit/callback'), false);
  assert.equal(isAllowedMobileRedirect('ludi-mobile:///other/path'), false);
  assert.equal(isAllowedMobileRedirect('https://untrusted.example/auth/replit/callback'), false);
});

test('Google callback allowlist permits only LUDI, trusted HTTPS web paths, and configured dev Expo', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    expoDomain: process.env.REPLIT_EXPO_DEV_DOMAIN,
    devDomain: process.env.REPLIT_DEV_DOMAIN,
    domains: process.env.REPLIT_DOMAINS,
    callbackUrl: process.env.GOOGLE_MOBILE_CALLBACK_URL,
  };
  try {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_MOBILE_CALLBACK_URL =
      'https://ludi-dont-just-watch-na.replit.app/api/auth/mobile/google/callback';
    delete process.env.REPLIT_EXPO_DEV_DOMAIN;
    delete process.env.REPLIT_DEV_DOMAIN;
    delete process.env.REPLIT_DOMAINS;
    assert.equal(isAllowedGoogleMobileRedirect('ludi-mobile:///auth/google/callback'), true);
    assert.equal(isAllowedGoogleMobileRedirect('ludi-mobile://auth/google/callback'), false);
    assert.equal(
      isAllowedGoogleMobileRedirect('https://ludi-dont-just-watch-na.replit.app/auth/google/callback'),
      true,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://ludi-dont-just-watch-na.replit.app/ludi-mobile/auth/google/callback'),
      true,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://ludi-dont-just-watch-na.replit.app/other'),
      false,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://untrusted.example/auth/google/callback'),
      false,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('exp://mobile.example.dev/--/auth/google/callback'),
      false,
    );

    process.env.NODE_ENV = 'development';
    process.env.REPLIT_EXPO_DEV_DOMAIN = 'mobile.example.dev';
    process.env.REPLIT_DEV_DOMAIN = 'web.example.dev';
    assert.equal(
      isAllowedGoogleMobileRedirect('exp://mobile.example.dev/--/auth/google/callback'),
      true,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://web.example.dev/auth/google/callback'),
      true,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('exp://untrusted.example/--/auth/google/callback'),
      false,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://mobile.example.dev/not-auth/google/callback'),
      false,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://mobile.example.dev/auth/google/callback?x=1'),
      false,
    );
    process.env.REPLIT_DOMAINS = 'preview-only.example.dev';
    assert.equal(
      isAllowedGoogleMobileRedirect('exp://preview-only.example.dev/--/auth/google/callback'),
      false,
    );
    assert.equal(
      isAllowedGoogleMobileRedirect('https://preview-only.example.dev/auth/google/callback'),
      true,
    );
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      REPLIT_EXPO_DEV_DOMAIN: previous.expoDomain,
      REPLIT_DEV_DOMAIN: previous.devDomain,
      REPLIT_DOMAINS: previous.domains,
      GOOGLE_MOBILE_CALLBACK_URL: previous.callbackUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Google callback URL uses configured HTTPS URL or a trusted HTTPS proxy origin', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    callbackUrl: process.env.GOOGLE_MOBILE_CALLBACK_URL,
    devDomain: process.env.REPLIT_DEV_DOMAIN,
  };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.GOOGLE_MOBILE_CALLBACK_URL =
      'https://ludi-dont-just-watch-na.replit.app/api/auth/mobile/google/callback';
    const productionRequest = {
      protocol: 'https',
      hostname: 'ludi-dont-just-watch-na.replit.app',
    };
    assert.equal(
      getGoogleMobileCallbackUrl(productionRequest),
      'https://ludi-dont-just-watch-na.replit.app/api/auth/mobile/google/callback',
    );
    delete process.env.GOOGLE_MOBILE_CALLBACK_URL;
    assert.equal(
      getGoogleMobileCallbackUrl({ ...productionRequest, protocol: 'http' }),
      undefined,
    );
    assert.equal(
      getGoogleMobileCallbackUrl({
        protocol: 'https',
        hostname: 'attacker.example',
      }),
      undefined,
    );
    process.env.GOOGLE_MOBILE_CALLBACK_URL =
      'http://ludi-dont-just-watch-na.replit.app/api/auth/mobile/google/callback';
    assert.equal(getGoogleMobileCallbackUrl(productionRequest), undefined);
    delete process.env.GOOGLE_MOBILE_CALLBACK_URL;
    assert.equal(getGoogleMobileCallbackUrl(productionRequest), undefined);
    process.env.NODE_ENV = 'development';
    process.env.REPLIT_DEV_DOMAIN = 'web.example.dev';
    assert.equal(
      getGoogleMobileCallbackUrl({
        protocol: 'https',
        hostname: 'web.example.dev',
      }),
      'https://web.example.dev/api/auth/mobile/google/callback',
    );
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      GOOGLE_MOBILE_CALLBACK_URL: previous.callbackUrl,
      REPLIT_DEV_DOMAIN: previous.devDomain,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Expo Go and web preview callbacks are confined to the workspace development host', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    expoDomain: process.env.REPLIT_EXPO_DEV_DOMAIN,
    devDomain: process.env.REPLIT_DEV_DOMAIN,
  };
  try {
    process.env.NODE_ENV = 'development';
    process.env.REPLIT_EXPO_DEV_DOMAIN = 'mobile.example.dev';
    process.env.REPLIT_DEV_DOMAIN = 'web.example.dev';
    assert.equal(isAllowedMobileRedirect('exp://mobile.example.dev/--/auth/replit/callback'), true);
    assert.equal(isAllowedMobileRedirect('https://mobile.example.dev/auth/replit/callback'), true);
    assert.equal(isAllowedMobileRedirect('exp://untrusted.example/--/auth/replit/callback'), false);
    assert.equal(isAllowedMobileRedirect('exp://mobile.example.dev/not-auth/replit/callback'), false);
    process.env.NODE_ENV = 'production';
    assert.equal(isAllowedMobileRedirect('exp://mobile.example.dev/--/auth/replit/callback'), false);
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      REPLIT_EXPO_DEV_DOMAIN: previous.expoDomain,
      REPLIT_DEV_DOMAIN: previous.devDomain,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});