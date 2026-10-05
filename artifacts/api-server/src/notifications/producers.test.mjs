import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise the actual producer/outbox functions with an isolated transaction
// double. No database credentials, Apple credentials, or network sends.
let state;
let failNotificationInsert = false;
const nameOf = table => table[Symbol.for('drizzle:Name')];
function rowsFor(table) {
  const name = nameOf(table);
  if (name === 'event_payments') return state.payments.map(payment => ({
    payment, kind: payment.status === 'captured' ? 'payment_captured' : 'payment_failed',
    key: `payment-state:${payment.id}:${payment.paymentIntentId || ''}:${payment.status === 'captured' ? 'payment_captured' : 'payment_failed'}`,
  }));
  return state[name] || [];
}
function selection() {
  let table, limit = Infinity;
  const q = {
    from(value) { table = value; return q; }, where() { return q; },
    orderBy() { return q; }, for() { return q; },
    limit(value) { limit = value; return q; },
    then(resolve, reject) { return Promise.resolve(rowsFor(table).slice(0, limit)).then(resolve, reject); },
  };
  return q;
}
function insertion(table) {
  let values, result;
  const run = () => {
    if (result) return result;
    const name = nameOf(table);
    if (name === 'notifications' && failNotificationInsert) throw new Error('Fixture insert failed');
    const rows = state[name] ||= [];
    result = [];
    for (const value of Array.isArray(values) ? values : [values]) {
      const unique = name === 'push_reminder_claims' ? 'key' : name === 'push_notification_outbox' ? 'notificationId' : 'dedupeKey';
      if (value[unique] && rows.some(row => row[unique] === value[unique])) continue;
      const row = { id: `fixture-${name}-${rows.length}`, createdAt: new Date(), ...value };
      rows.push(row);
      result.push(row);
    }
    return result;
  };
  const q = {
    values(value) { values = value; return q; }, onConflictDoNothing() { return q; },
    returning() { return Promise.resolve().then(run); },
    then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
  };
  return q;
}
const fixtureDb = {
  execute: async () => ({ rows: [{ outbox: state.hooks, payments: state.hooks }] }),
  select: selection,
  insert: insertion,
  delete: table => ({ where: async () => { state[nameOf(table)] = []; } }),
  transaction: async fn => {
    const before = structuredClone(state);
    try { return await fn(fixtureDb); }
    catch (error) { state = before; throw error; }
  },
};
globalThis.__ludiNotificationProducerFixture = fixtureDb;
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./service.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  plugins: [{
    name: 'isolated-notification-producers',
    setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({
        path: fileURLToPath(new URL('../../../../lib/db/src/schema/index.ts', import.meta.url)),
      }));
      b.onResolve({ filter: /^\.\.\/(db|lib\/logger|websocket)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === '../db'
          ? 'export const db = globalThis.__ludiNotificationProducerFixture;'
          : args.path === '../websocket'
            ? 'export const notificationWS = {sendNotification(){}};'
            : 'export const logger = {error(){}};',
        loader: 'js',
      }));
    },
  }],
});
const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function reset() {
  failNotificationInsert = false;
  state = {
    hooks: false, payments: [], notifications: [], push_notification_outbox: [], push_reminder_claims: [], push_deliveries: [],
    events: [{ id: 'fixture-event', name: 'Test match', primaryTeamId: 'fixture-team', startDate: '2026-10-10', startTime: '19:30', location: 'Test venue' }],
    teams: [{ id: 'fixture-team', name: 'Test team' }],
    push_triggers: [{ id: 'event_created', enabled: true, templateId: 'fixture-template', audience: 'existing', updatedAt: new Date(Date.now() - 120_000) }],
    push_templates: [{ id: 'fixture-template', title: '{eventName}', body: 'Open LUDI for {teamName}.' }],
    notification_preferences: [{ userId: 'fixture-user', pushNotificationsIOS: true, newEvents: true, updatedAt: new Date(Date.now() - 120_000) }],
    push_devices: [{ id: 'fixture-device', userId: 'fixture-user', enabled: true }],
  };
}
test('missing SQL hooks: ordinary notifications reach the durable outbox exactly once', async () => {
  reset();
  state.notifications.push({ id: 'fixture-notice', userId: 'fixture-user', type: 'new_event', message: 'New match', relatedId: 'fixture-event', createdAt: new Date() });
  await service.reconcileNotificationProducers();
  await service.reconcileNotificationProducers();
  assert.equal(state.push_notification_outbox.length, 1);
  await service.processNotificationOutbox();
  assert.equal(state.push_deliveries.length, 1);
  assert.equal(state.push_deliveries[0].data.userId, 'fixture-user');
  await service.reconcileNotificationProducers();
  assert.equal(state.push_notification_outbox.length, 0);
});
test('missing payment hook: captured and failed payment notices are claimed once per intent/status', async () => {
  reset();
  state.payments = [
    { id: 'fixture-payment-1', status: 'captured', paymentIntentId: 'fixture-intent-1', userId: 'fixture-user', eventId: 'fixture-event', updatedAt: new Date(), capturedAmountMinor: 1000 },
    { id: 'fixture-payment-2', status: 'failed', paymentIntentStatus: 'requires_payment_method', paymentIntentId: 'fixture-intent-2', userId: 'fixture-user', eventId: 'fixture-event', updatedAt: new Date() },
  ];
  await service.reconcileNotificationProducers();
  await service.reconcileNotificationProducers();
  assert.deepEqual(state.notifications.map(n => n.type), ['payment_captured', 'payment_failed']);
  assert.equal(state.push_notification_outbox.length, 2);
});
test('existing hooks remain responsible; compatibility producer does not duplicate their work', async () => {
  reset();
  state.hooks = true;
  state.notifications.push({ id: 'fixture-existing' });
  await service.reconcileNotificationProducers();
  assert.equal(state.push_reminder_claims.length, 0);
  assert.equal(state.push_notification_outbox.length, 0);
});
test('payment producer insert failure rolls back its claim so retry can succeed', async () => {
  reset();
  state.payments = [{ id: 'fixture-payment', status: 'captured', paymentIntentId: 'fixture-intent', userId: 'fixture-user', eventId: 'fixture-event', updatedAt: new Date() }];
  failNotificationInsert = true;
  await assert.rejects(service.reconcileNotificationProducers(), /Fixture insert failed/);
  assert.equal(state.push_reminder_claims.length, 0);
  failNotificationInsert = false;
  await service.reconcileNotificationProducers();
  assert.equal(state.notifications.length, 1);
});
test('enabling push or a trigger does not replay older compatibility records', async () => {
  reset();
  state.notifications.push({ id: 'fixture-old', userId: 'fixture-user', type: 'new_event', message: 'Old match', createdAt: new Date(Date.now() - 3600_000) });
  await service.reconcileNotificationProducers();
  await service.processNotificationOutbox();
  assert.equal(state.push_deliveries.length, 0);
});

test('multiple immediate configurations each queue once per notification and device', async () => {
  reset();
  state.push_triggers.push({ ...state.push_triggers[0], id: 'event_created:second' });
  state.notifications.push({ id: 'fixture-notice', userId: 'fixture-user', type: 'new_event', message: 'New match', createdAt: new Date() });
  state.push_notification_outbox = [{ notificationId: 'fixture-notice' }];
  await service.processNotificationOutbox();
  assert.deepEqual(state.push_deliveries.map(d => d.triggerId), ['event_created', 'event_created:second']);
  assert.equal(new Set(state.push_deliveries.map(d => d.dedupeKey)).size, 2);
  // Preserve the dedupe key of already queued legacy deliveries.
  assert.equal(state.push_deliveries[0].dedupeKey, 'fixture-notice:fixture-device');
  state.push_notification_outbox = [{ notificationId: 'fixture-notice' }];
  await service.processNotificationOutbox();
  assert.equal(state.push_deliveries.length, 2);
});

test('two before-event reminders have independent claims and push only their own configuration', async () => {
  reset();
  const start = new Date(Date.now() + 30 * 60_000).toISOString();
  state.events[0].startDate = start.slice(0, 10);
  state.events[0].startTime = start.slice(11, 16);
  state.event_attendance = [{ userId: 'fixture-user', eventId: 'fixture-event', status: 'attending' }];
  const common = { enabled: true, templateId: 'fixture-template', audience: 'attendees', updatedAt: new Date(Date.now() - 3 * 86400_000) };
  state.push_triggers = [
    { ...common, id: 'event_reminder', reminderMinutes: 1440 },
    { ...common, id: 'event_reminder:second', reminderMinutes: 60 },
  ];
  await service.processScheduledReminders();
  await service.processScheduledReminders();
  assert.equal(state.notifications.length, 2);
  assert.equal(state.push_reminder_claims.length, 2);
  assert.deepEqual(state.notifications.map(n => JSON.parse(n.metadata).configurationId), ['event_reminder', 'event_reminder:second']);
  const reminders = [...state.notifications];
  // Isolate each outbox record because this fixture deliberately does not
  // interpret Drizzle SQL predicates.
  for (const reminder of reminders) {
    state.notifications = [reminder];
    state.push_notification_outbox = [{ notificationId: reminder.id }];
    await service.processNotificationOutbox();
  }
  assert.equal(state.push_deliveries.length, 2, 'No cross-product of reminders and configurations');
  assert.deepEqual(state.push_deliveries.map(d => d.triggerId), ['event_reminder', 'event_reminder:second']);
  assert.ok(state.push_deliveries.every(d => d.data.triggerId === 'event_reminder'));
});
