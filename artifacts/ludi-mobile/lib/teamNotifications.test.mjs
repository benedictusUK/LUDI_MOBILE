import test from 'node:test';
import assert from 'node:assert/strict';
import { teamInvitationId, teamNotificationMetadata, teamNotificationResolved } from './teamNotifications.js';

test('legacy relatedId and new metadata both identify the real invitation', () => {
  assert.equal(teamInvitationId({ relatedId: 'invite-1', metadata: null }), 'invite-1');
  assert.equal(teamInvitationId({ relatedId: 'team-1', metadata: '{"invitationId":"invite-2"}' }), 'invite-2');
  assert.equal(teamInvitationId({ metadata: { invitationId: 'invite-3' } }), 'invite-3');
});
test('reading is not resolving, and resolved invitations no longer have action buttons', () => {
  assert.equal(teamNotificationResolved({ isRead: true, metadata: null }), false);
  for (const resolvedStatus of ['accepted', 'declined']) {
    assert.equal(teamNotificationResolved({ metadata: JSON.stringify({ resolvedStatus }) }), true);
    assert.equal(teamNotificationResolved({ metadata: { resolvedStatus } }), true);
  }
});
test('websocket metadata and historical malformed metadata do not break the inbox', () => {
  assert.deepEqual(teamNotificationMetadata({ metadata: { teamId: 'team', requestUserId: 'user' } }), { teamId: 'team', requestUserId: 'user' });
  assert.deepEqual(teamNotificationMetadata({ metadata: 'bad json' }), {});
  assert.equal(teamInvitationId({ metadata: 'bad json', relatedId: 'invite' }), 'invite');
});
