import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAccessDenied, isVerifiedAdmin } from './adminAccess.mjs';

test('only the current account with explicit server SuperAdmin access is allowed', () => {
  assert.equal(isVerifiedAdmin({ userId: 'admin', isSuperAdmin: true }, 'admin'), true);
  for (const result of [
    null, {}, { userId: 'admin', isSuperAdmin: false },
    { userId: 'admin', isSuperAdmin: 'true' }, { userId: 'previous', isSuperAdmin: true },
  ]) assert.equal(isVerifiedAdmin(result, 'admin'), false);
  assert.equal(isVerifiedAdmin({ userId: '', isSuperAdmin: true }, ''), false);
});

test('permission failures revoke controls; server/network failures remain retryable', () => {
  assert.equal(isAccessDenied({ status: 401 }), true);
  assert.equal(isAccessDenied({ status: 403 }), true);
  for (const error of [null, {}, { status: 400 }, { status: 409 }, { status: 429 }, { status: 503 }]) {
    assert.equal(isAccessDenied(error), false);
  }
});
