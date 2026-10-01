import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import appleSignin from 'apple-signin-auth';
import { verifyAppleMobileToken } from './appleMobileAuth.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const keyId = 'ludi-test-key';
const publicJwk = publicKey.export({ format: 'jwk' });
const originalFetch = globalThis.fetch;

function createToken(claims = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://appleid.apple.com',
    aud: 'app.replit.ludi',
    exp: now + 300,
    iat: now,
    sub: 'apple-test-subject',
    email: 'person@example.test',
    ...claims,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId }))
    .toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
    .toString('base64url');
  const token = `${signingInput}.${signature}`;

  if (options.tamperSignature) {
    const replacement = signature[0] === 'a' ? 'b' : 'a';
    return `${signingInput}.${replacement}${signature.slice(1)}`;
  }

  return token;
}

async function withAppleTestSetup(run, { nodeEnv = 'production', clientId } = {}) {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    clientId: process.env.APPLE_MOBILE_CLIENT_ID,
  };

  process.env.NODE_ENV = nodeEnv;
  if (clientId === undefined) delete process.env.APPLE_MOBILE_CLIENT_ID;
  else process.env.APPLE_MOBILE_CLIENT_ID = clientId;

  appleSignin._setFetch(async (url) => {
    assert.equal(url, 'https://appleid.apple.com/auth/keys');
    return {
      text: async () => JSON.stringify({ keys: [{ ...publicJwk, kid: keyId }] }),
    };
  });

  try {
    return await run();
  } finally {
    appleSignin._setFetch(originalFetch);
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      APPLE_MOBILE_CLIENT_ID: previous.clientId,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('production accepts both LUDI mobile bundle identifiers', async () => {
  await withAppleTestSetup(async () => {
    for (const audience of ['app.replit.ludi', 'com.ludi.mobile']) {
      assert.deepEqual(
        await verifyAppleMobileToken(createToken({ aud: audience })),
        { sub: 'apple-test-subject', email: 'person@example.test' },
      );
    }
  });
});

test('production rejects Expo Go and unrelated audiences', async () => {
  await withAppleTestSetup(async () => {
    for (const audience of ['host.exp.Exponent', 'unrelated.example']) {
      await assert.rejects(
        verifyAppleMobileToken(createToken({ aud: audience })),
      );
    }
  });
});

test('rejects expired tokens, wrong issuer, tampered signatures, and missing subjects', async () => {
  await withAppleTestSetup(async () => {
    await assert.rejects(
      verifyAppleMobileToken(createToken({ exp: Math.floor(Date.now() / 1000) - 60 })),
    );
    await assert.rejects(
      verifyAppleMobileToken(createToken({ iss: 'https://wrong-issuer.example' })),
    );
    await assert.rejects(
      verifyAppleMobileToken(createToken({}, { tamperSignature: true })),
    );
    await assert.rejects(
      verifyAppleMobileToken(createToken({ sub: undefined })),
      /no subject/i,
    );
  });
});

test('returns null when the token omits email', async () => {
  await withAppleTestSetup(async () => {
    assert.deepEqual(
      await verifyAppleMobileToken(createToken({ email: undefined })),
      { sub: 'apple-test-subject', email: null },
    );
  });
});

test('APPLE_MOBILE_CLIENT_ID replaces the production audience defaults', async () => {
  await withAppleTestSetup(async () => {
    await assert.rejects(
      verifyAppleMobileToken(createToken({ aud: 'app.replit.ludi' })),
    );
    assert.deepEqual(
      await verifyAppleMobileToken(createToken({ aud: 'custom.ludi.client' })),
      { sub: 'apple-test-subject', email: 'person@example.test' },
    );
  }, { clientId: 'custom.ludi.client' });
});

test('development accepts Expo Go tokens', async () => {
  await withAppleTestSetup(async () => {
    assert.deepEqual(
      await verifyAppleMobileToken(createToken({ aud: 'host.exp.Exponent' })),
      { sub: 'apple-test-subject', email: 'person@example.test' },
    );
  }, { nodeEnv: 'development' });
});