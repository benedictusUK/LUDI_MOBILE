import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import {
  createGoogleMobileHandoff,
  isValidGooglePkceChallenge,
  verifyGoogleMobileHandoff,
} from './googleMobileHandoff.ts';
import { getNormalMobileTokenUserId } from './mobileToken.ts';

const secret = 'test-secret-used-only-by-this-test';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');

function signTicket(claims = {}, signingSecret = secret) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      purpose: 'google-mobile-handoff',
      codeChallenge: challenge,
      iat: now,
      exp: now + 60,
      ...claims,
    },
    signingSecret,
    {
      algorithm: 'HS256',
      audience: 'ludi-google-handoff',
      issuer: 'ludi-mobile-auth',
      subject: 'google_authenticated_user',
    },
  );
}

test('Google handoff validates signed subject and PKCE S256 challenge without an app userId claim', () => {
  const ticket = createGoogleMobileHandoff(
    'google_authenticated_user',
    challenge,
    secret,
  );
  const claims = jwt.decode(ticket);
  assert.equal(claims.userId, undefined);
  assert.equal(verifyGoogleMobileHandoff(ticket, verifier, secret), 'google_authenticated_user');
  assert.equal(verifyGoogleMobileHandoff(ticket, 'b'.repeat(43), secret), undefined);
  assert.equal(verifyGoogleMobileHandoff(ticket, verifier, 'wrong-secret'), undefined);
});

test('Google handoff rejects expired, wrong-purpose, and invalid-signature tickets', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(
    verifyGoogleMobileHandoff(
      signTicket({ iat: now - 120, exp: now - 1 }),
      verifier,
      secret,
    ),
    undefined,
  );
  assert.equal(
    verifyGoogleMobileHandoff(
      signTicket({ purpose: 'mobile-access' }),
      verifier,
      secret,
    ),
    undefined,
  );

  const validTicket = signTicket();
  const [header, payload, signature] = validTicket.split('.');
  const replacement = signature[0] === 'a' ? 'b' : 'a';
  assert.equal(
    verifyGoogleMobileHandoff(
      `${header}.${payload}.${replacement}${signature.slice(1)}`,
      verifier,
      secret,
    ),
    undefined,
  );
});

test('normal app JWTs and handoff tokens with app userId are rejected as handoffs', () => {
  const appToken = jwt.sign(
    { userId: 'google_authenticated_user' },
    secret,
    { expiresIn: '30d' },
  );
  const handoffWithUserId = signTicket({ userId: 'google_authenticated_user' });
  assert.equal(verifyGoogleMobileHandoff(appToken, verifier, secret), undefined);
  assert.equal(verifyGoogleMobileHandoff(handoffWithUserId, verifier, secret), undefined);
  assert.equal(isValidGooglePkceChallenge(challenge), true);
  assert.equal(isValidGooglePkceChallenge('not-a-valid-s256-challenge'), false);
});

test('the application JWT middleware claim check rejects a signed handoff token', () => {
  const handoff = createGoogleMobileHandoff(
    'google_authenticated_user',
    challenge,
    secret,
  );
  const appToken = jwt.sign(
    { userId: 'google_authenticated_user' },
    secret,
    { expiresIn: '30d' },
  );
  assert.equal(
    getNormalMobileTokenUserId(jwt.verify(handoff, secret)),
    undefined,
  );
  assert.equal(
    getNormalMobileTokenUserId(jwt.verify(appToken, secret)),
    'google_authenticated_user',
  );
});