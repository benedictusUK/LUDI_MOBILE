import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STARTUP_ANIMATION_DURATION_MS, startupPhase } from './startup.js';

const ready = { animationComplete: true, authLoading: false, authError: null,
  themeLoading: false, fontsReady: true, isAuthenticated: true, dashboardReady: true, dashboardError: null };

test('the supplied animation plays exactly once with its measured full duration', () => {
  const asset = readFileSync(new URL('../assets/images/ludi-startup-v2.webp', import.meta.url));
  let duration = 0, frames = 0, loopCount;
  for (let offset = 12; offset < asset.length;) {
    const tag = asset.toString('ascii', offset, offset + 4);
    const length = asset.readUInt32LE(offset + 4);
    if (tag === 'ANIM') loopCount = asset.readUInt16LE(offset + 12);
    if (tag === 'ANMF') { duration += asset.readUIntLE(offset + 20, 3); frames++; }
    offset += 8 + length + length % 2;
  }
  assert.equal(loopCount, 1);
  assert.equal(frames, 98);
  assert.equal(duration, STARTUP_ANIMATION_DURATION_MS);
  assert.ok(duration >= 2000 && duration <= 2500, 'Startup playback should take 2–2.5 seconds');
  const poster = readFileSync(new URL('../assets/images/ludi-startup-final.png', import.meta.url));
  assert.equal(poster.readUInt32BE(16), 752);
  assert.equal(poster.readUInt32BE(20), 752);
});
test('fast data cannot skip playback, for home or login', () => {
  assert.equal(startupPhase({ ...ready, animationComplete: false }), 'animation');
  assert.equal(startupPhase({ ...ready, animationComplete: false, isAuthenticated: false }), 'animation');
});
test('slow authentication, fonts, theme and dashboard hold the final frame until ready', () => {
  for (const delay of [{ authLoading: true }, { fontsReady: false }, { themeLoading: true }, { dashboardReady: false }]) {
    assert.equal(startupPhase({ ...ready, ...delay }), 'waiting');
  }
  assert.equal(startupPhase(ready), 'home');
  assert.equal(startupPhase({ ...ready, isAuthenticated: false, dashboardReady: false }), 'login');
});
test('errors become visible after playback, and retry does not replay the intro', () => {
  assert.equal(startupPhase({ ...ready, authError: 'offline', isAuthenticated: false }), 'error');
  assert.equal(startupPhase({ ...ready, dashboardReady: false, dashboardError: 'offline' }), 'error');
  assert.equal(startupPhase({ ...ready, authLoading: true }), 'waiting');
  assert.equal(startupPhase({ ...ready, dashboardReady: false }), 'waiting');
  assert.equal(startupPhase({ ...ready, dashboardReady: true, dashboardError: 'refresh failed' }), 'home');
});
