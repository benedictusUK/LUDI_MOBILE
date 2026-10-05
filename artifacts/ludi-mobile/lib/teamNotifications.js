export function teamNotificationMetadata(notification) {
  const value = notification?.metadata;
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return {};
}
export function teamNotificationResolved(notification) {
  const status = teamNotificationMetadata(notification).resolvedStatus;
  return status === 'accepted' || status === 'declined';
}
export function teamInvitationId(notification) {
  return teamNotificationMetadata(notification).invitationId || notification?.relatedId;
}
