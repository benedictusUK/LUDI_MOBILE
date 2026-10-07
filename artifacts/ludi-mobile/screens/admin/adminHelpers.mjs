export function errInfo(e) {
  const data = e && e.data;
  const message = (data && (data.error || data.message)) || (e && e.message) || 'Something went wrong.';
  return { status: e && e.status, message: String(message) };
}
export const isAccessError = (e) => !!e && (e.status === 401 || e.status === 403);
export const fmtDate = (s) => {
  if (!s) return '-';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
};
export const audienceLabel = (a) => ({
  existing: 'Relevant notification recipients',
  attendees: 'Event attendees',
  maybe_voters: 'Maybe Voters',
  team_members: 'All Team Members',
  flare_recipients: 'Opted-in Flare Recipients',
  payment_recipient: 'Relevant payment player',
}[a] || String(a).replace(/_/g, ' '));
export const audienceDescription = (a) => ({
  attendees: 'Players who voted Yes, including players on the reserve list.',
  maybe_voters: 'Players who voted Maybe on this event.',
  team_members: 'Team members, regardless of their event vote.',
  flare_recipients: 'Eligible nearby players who opted in to flare notifications.',
  payment_recipient: 'Only the player whose payment needs attention or has changed.',
}[a] || '');
export const placeholderToken = (name) => `{${name}}`;
/** Decimal string with at most 2 dp -> integer hundredths, or null if invalid / above max. */
export function toHundredths(s, max) {
  const t = String(s).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const n = Number(w) * 100 + Number((f + '00').slice(0, 2));
  return Number.isSafeInteger(n) && n <= max ? n : null;
}
export const fromHundredths = (n) => (n / 100).toFixed(2);
export const gbp = (minor) => `\u00a3${(minor / 100).toFixed(2)}`;
export const describeFees = (s) =>
  `${fromHundredths(s.platformBasisPoints)}% platform, ${fromHundredths(s.stripeBasisPoints)}% + ${gbp(s.stripeFixedMinor)} processing (revision ${s.revision})`;
export function parseMinutes(s) {
  const t = String(s).trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 5 && n <= 10080 ? n : null;
}
export const testBlockReason = (cfg) =>
  !cfg ? '' : !cfg.configured ? 'Apple push credentials are not configured.'
    : cfg.ownDeviceCount < 1 ? 'None of your own iPhones are registered and opted in.' : '';
