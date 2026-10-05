import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the style adapter without a native renderer. StyleSheet.flatten is
// the only native operation used by this pure transformation.
const source = readFileSync(new URL('./useBrandStyles.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?$/gm, '')
  .replace(/\bexport (default )?/g, '');
const context = vm.createContext({
  StyleSheet: { flatten: value => Array.isArray(value) ? Object.assign({}, ...value) : value },
  Platform: { OS: 'ios' },
});
vm.runInContext(source, context);
const palette = {
  background: '#071728', surface: '#10243a', text: '#f2f7fc',
  border: '#304b63', muted: '#acbfd0', mint: '#42e6b5',
};
const fonts = { body: { fontFamily: 'LudiBody' }, display: { fontFamily: 'LudiDisplay' } };
const adapt = (base, typography = fonts) => context.brandize(base, palette, typography, true, 0);

test('dark foreground slate becomes readable ink, not a surface colour', () => {
  const result = adapt({ title: { color: '#1e293b', fontSize: 24, fontWeight: '700' } });
  assert.equal(result.title.color, palette.text);
  assert.equal(result.title.fontFamily, 'LudiDisplay');
});

test('body text and inputs use the bundled body face', () => {
  const result = adapt({ input: { fontSize: 16, color: '#334155' } });
  assert.equal(result.input.fontFamily, 'LudiBody');
  assert.equal(result.input.color, palette.text);
});

test('font failure keeps the original size and system fallback', () => {
  const result = adapt({ title: { fontSize: 24, fontWeight: '700' } },
    { body: {}, display: { fontWeight: '800', fontStyle: 'italic' } });
  assert.equal(result.title.fontFamily, undefined);
  assert.equal(result.title.fontSize, 24);
});

test('icon faces and decorative radio dimensions are left alone', () => {
  const result = adapt({
    icon: { fontSize: 20 },
    radioButton: { width: 20, height: 20, borderRadius: 10 },
  });
  assert.equal(result.icon.fontFamily, undefined);
  assert.equal(result.radioButton.width, 20);
  assert.equal(result.radioButton.height, 20);
});

test('small back controls reserve a 44-point touch area', () => {
  const result = adapt({ backButton: { width: 32, height: 32, borderRadius: 12 } });
  assert.equal(result.backButton.width, 44);
  assert.equal(result.backButton.height, 44);
});

test('mint labels use dark ink while blue hero overlays stay white', () => {
  const result = adapt({
    authorizeButtonText: { fontSize: 16, color: '#ffffff' },
    liveEventTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  });
  assert.equal(result.authorizeButtonText.color, '#06231e');
  assert.equal(result.liveEventTitle.color, '#ffffff');
});

test('restyling does not mutate the source styles', () => {
  const base = { card: { backgroundColor: '#ffffff', borderRadius: 12 } };
  adapt(base);
  assert.equal(base.card.backgroundColor, '#ffffff');
  assert.equal(base.card.borderRadius, 12);
});

test('warning and success panels do not keep pale light-mode fills in dark mode', () => {
  const result = adapt({
    warning: { backgroundColor: '#fef3c7' },
    success: { backgroundColor: '#d1fae5' },
  });
  assert.equal(result.warning.backgroundColor, '#3b3329');
  assert.equal(result.success.backgroundColor, '#0d3a35');
});
