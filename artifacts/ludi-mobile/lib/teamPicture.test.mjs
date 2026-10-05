import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./teamPicture.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?$/gm, '').replace(/\bexport /g, '');
const ctx = vm.createContext({
  API_BASE_URL: 'https://api.example.test', Platform: { OS: 'web' },
  Alert: { alert: () => {} }, Linking: {}, ImagePicker: {},
});
vm.runInContext(source, ctx);
const asset = { uri: 'blob:photo', mimeType: 'image/png' };
const objectPath = '/objects/uploads/12345678-1234-1234-1234-123456789abc';

test('pictures resolve against the current API; missing pictures retain the icon fallback', () => {
  assert.equal(ctx.getTeamPictureUri(null), null);
  assert.equal(ctx.getTeamPictureUri(objectPath), 'https://api.example.test' + objectPath);
  assert.equal(ctx.getTeamPictureUri('https://images.example.test/photo.png'), 'https://images.example.test/photo.png');
  assert.equal(ctx.getTeamPictureUri('javascript:alert(1)'), null);
});
test('cancelled photo selection does not alter an optional picture', async () => {
  ctx.ImagePicker.launchImageLibraryAsync = async () => ({ canceled: true });
  assert.equal(await ctx.pickTeamPicture(), null);
});
test('uploads use raw bytes and return a persistent object path', async () => {
  const calls = [];
  const blob = { size: 100, type: 'image/png' };
  ctx.fetch = async (url, options) => {
    calls.push({ url, options });
    return options ? { ok: true } : { ok: true, blob: async () => blob };
  };
  const path = await ctx.uploadTeamPicture(asset, async (url, options) => {
    assert.equal(url, '/api/objects/upload');
    assert.equal(options.method, 'POST');
    return { ok: true, json: async () => ({ uploadURL: 'https://storage.example.test/upload', objectPath }) };
  });
  assert.equal(path, objectPath);
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[1].options.headers['Content-Type'], 'image/png');
  assert.equal(calls[1].options.body, blob);
});
test('failed storage uploads are not treated as saved pictures', async () => {
  ctx.fetch = async (_url, options) => options ? { ok: false } : { ok: true, blob: async () => ({ size: 100, type: 'image/png' }) };
  await assert.rejects(ctx.uploadTeamPicture(asset, async () => ({
    ok: true, json: async () => ({ uploadURL: 'https://storage.example.test/upload', objectPath }),
  })), /could not be uploaded/);
});
test('oversized files fail before requesting an upload URL', async () => {
  ctx.fetch = async () => ({ ok: true, blob: async () => ({ size: 6 * 1024 * 1024, type: 'image/png' }) });
  await assert.rejects(ctx.uploadTeamPicture(asset, async () => { throw new Error('must not run'); }), /smaller than 5 MB/);
});
