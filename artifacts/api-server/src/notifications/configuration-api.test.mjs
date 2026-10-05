import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import express from 'express';
import { fileURLToPath } from 'node:url';

// Exercise real route handlers and generated validation without touching a
// database, credentials, or APNs. This double interprets the single-column
// equality predicates used for configuration CRUD.
let state;
const tableName = table => table[Symbol.for('drizzle:Name')];
function predicate(sql) {
  const chunks = sql?.queryChunks || [];
  const column = chunks.find(c => c?.table && c?.name);
  const parameter = chunks.find(c => c?.constructor?.name === 'Param');
  if (!column || !parameter) return () => true;
  const key = Object.entries(column.table).find(([, value]) => value === column)?.[0];
  return row => row[key] === parameter.value;
}
const fixtureDb = {
  execute: async () => ({ rows: [{ outboxReady: false, paymentHooksReady: false }] }),
  select: projection => {
    let table, condition, limit = Infinity;
    const q = {
      from(t) { table = t; return q; },
      where(c) { condition = c; return q; },
      orderBy() { return q; }, for() { return q; }, innerJoin() { return q; },
      limit(n) { limit = n; return q; },
      then(resolve, reject) {
        const rows = (state[tableName(table)] || []).filter(predicate(condition)).slice(0, limit);
        return Promise.resolve(projection?.count ? [{ count: rows.length }] : rows).then(resolve, reject);
      },
    };
    return q;
  },
  insert: table => {
    let input, conflict, result;
    const run = () => {
      if (result) return result;
      const rows = state[tableName(table)] ||= [];
      result = [];
      for (const value of Array.isArray(input) ? input : [input]) {
        const existing = value.id && rows.find(r => r.id === value.id);
        if (existing && conflict) { Object.assign(existing, conflict.set); result.push(existing); }
        else {
          const row = { id: `fixture-${rows.length}`, updatedAt: new Date(), ...value };
          rows.push(row); result.push(row);
        }
      }
      return result;
    };
    const q = {
      values(v) { input = v; return q; },
      onConflictDoUpdate(c) { conflict = c; return q; },
      returning() { return Promise.resolve().then(run); },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
    };
    return q;
  },
  delete: table => {
    let condition, result;
    const run = () => {
      if (result) return result;
      const rows = state[tableName(table)] || [];
      result = rows.filter(predicate(condition));
      state[tableName(table)] = rows.filter(r => !result.includes(r));
      return result;
    };
    const q = {
      where(c) { condition = c; return q; },
      returning() { return Promise.resolve().then(run); },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
    };
    return q;
  },
  transaction: async fn => {
    const before = structuredClone(state);
    try { return await fn(fixtureDb); }
    catch (error) { state = before; throw error; }
  },
};
globalThis.__ludiConfigurationApiFixture = fixtureDb;
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../routes/notificationAdmin.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  plugins: [{
    name: 'configuration-api-fixture',
    setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({
        path: fileURLToPath(new URL('../../../../lib/db/src/schema/index.ts', import.meta.url)),
      }));
      b.onResolve({ filter: /^\.\.\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      b.onResolve({ filter: /^\.\.\/notifications\/apns$/ }, () => ({ path: 'apns', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === 'db'
          ? 'export const db = globalThis.__ludiConfigurationApiFixture;'
          : 'export const apnsConfiguration = () => ({configured:false,missing:[],bundleId:"fixture.bundle"});',
        loader: 'js',
      }));
    },
  }],
});
const { registerNotificationAdmin } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('notification configuration API: independent CRUD, validation and authorization', async () => {
  state = {
    platform_admins: [{ userId: 'fixture-admin' }],
    push_templates: [{ id: 'fixture-template', name: 'Reminder', title: '{eventName}', body: 'Starts soon', updatedAt: new Date() }],
    push_triggers: [], push_deliveries: [], push_devices: [], push_admin_audit: [],
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { error() {} }; next(); });
  registerNotificationAdmin(app, (req, res, next) => {
    const user = req.get('x-fixture-user');
    if (!user) { res.status(401).json({ message: 'Sign in' }); return; }
    req.userId = user; next();
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/notifications`;
  const request = async (path = '', method = 'GET', data, user = 'fixture-admin') => {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-fixture-user': user } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  try {
    assert.equal((await request('', 'GET', null, '')).status, 401);
    assert.equal((await request('', 'GET', null, 'ordinary-user')).status, 403);
    const empty = await request();
    assert.equal(empty.status, 200, JSON.stringify(empty.data));
    assert.deepEqual(empty.data.triggers, []);
    assert.equal(empty.data.triggerTypes.length, 10);
    const input = { type: 'event_reminder', enabled: false, audience: 'attendees', templateId: 'fixture-template', reminderMinutes: 1440 };
    const first = await request('/triggers', 'POST', input);
    const second = await request('/triggers', 'POST', { ...input, reminderMinutes: 60 });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.data.id, second.data.id);
    assert.equal(first.data.type, 'event_reminder');
    assert.equal(first.data.enabled, false);
    assert.equal((await request()).data.triggers.length, 2);
    const { type, ...settings } = input;
    const edited = await request(`/triggers/${second.data.id}`, 'PUT', { ...settings, reminderMinutes: 30 });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.id, second.data.id);
    assert.equal(edited.data.reminderMinutes, 30);
    assert.deepEqual((await request()).data.triggers.map(t => t.reminderMinutes), [1440, 30]);
    for (const invalid of [
      { ...input, type: 'unsupported' }, { ...input, reminderMinutes: 4 },
      { ...input, reminderMinutes: 10081 }, { ...input, reminderMinutes: 60.5 },
      { ...input, audience: 'existing' }, { ...input, templateId: 'missing-template' },
    ]) assert.equal((await request('/triggers', 'POST', invalid)).status, 400);
    assert.equal((await request('/templates/fixture-template', 'DELETE')).status, 409);
    assert.equal((await request(`/triggers/${first.data.id}`, 'DELETE')).status, 204);
    assert.equal((await request()).data.triggers.length, 1);
    assert.equal((await request(`/triggers/${first.data.id}`, 'PUT', settings)).status, 404);
    assert.equal((await request(`/triggers/${first.data.id}`, 'DELETE')).status, 404);
    assert.equal((await request('/triggers/event_reminder', 'PUT', settings)).status, 200, 'Installed legacy clients retain catalog-ID upsert');
    assert.equal((await request()).data.triggers.length, 2);
    assert.ok(state.push_admin_audit.some(a => a.action === 'trigger_created'));
    assert.ok(state.push_admin_audit.some(a => a.action === 'trigger_deleted'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete globalThis.__ludiConfigurationApiFixture;
  }
});
