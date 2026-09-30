import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedMobileRedirect } from './mobileRedirect.ts';

test('standalone LUDI callback uses the exact triple-slash deep link', () => {
  assert.equal(isAllowedMobileRedirect('ludi-mobile:///auth/replit/callback'), true);
  assert.equal(isAllowedMobileRedirect('ludi-mobile://auth/replit/callback'), false);
  assert.equal(isAllowedMobileRedirect('ludi-mobile:///other/path'), false);
  assert.equal(isAllowedMobileRedirect('https://untrusted.example/auth/replit/callback'), false);
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