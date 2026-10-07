import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audienceDescription, audienceLabel, toHundredths, fromHundredths, parseMinutes, placeholderToken, testBlockReason, errInfo } from './adminHelpers.mjs';

test('recipient groups have explicit labels and describe Yes/Maybe/flare eligibility', () => {
  assert.equal(audienceLabel('attendees'), 'Event attendees');
  assert.equal(audienceLabel('maybe_voters'), 'Maybe Voters');
  assert.equal(audienceLabel('team_members'), 'All Team Members');
  assert.equal(audienceLabel('flare_recipients'), 'Opted-in Flare Recipients');
  assert.match(audienceDescription('attendees'), /voted Yes/);
  assert.match(audienceDescription('maybe_voters'), /voted Maybe/);
  assert.match(audienceDescription('flare_recipients'), /Eligible nearby.*opted in/);
});

test('fee input converts percentages/pounds to exact integer basis points/pence', () => {
  for (const [input, value] of [['0', 0], ['2.99', 299], ['5', 500], ['100.00', 10000], [' 0.30 ', 30]]) {
    assert.equal(toHundredths(input, 10000), value);
    assert.equal(toHundredths(fromHundredths(value), 10000), value);
  }
  assert.equal(toHundredths('10000.00', 1000000), 1000000);
});

test('fee input rejects blanks, negative numbers, extra decimals and out-of-range values', () => {
  for (const input of ['', ' ', '-1', '.5', '1e2', '1,50', '2.999', '100.01', 'NaN', 'Infinity']) {
    assert.equal(toHundredths(input, 10000), null);
  }
  assert.equal(toHundredths('10000.01', 1000000), null);
});

test('reminders accept only whole minutes from 5 to 10080', () => {
  for (const input of ['5', '60', '10080']) assert.equal(parseMinutes(input), Number(input));
  for (const input of ['', '4', '10081', '5.5', '-5', '1e2', 'NaN']) assert.equal(parseMinutes(input), null);
});

test('push tests need configured Apple credentials and own opted-in devices', () => {
  assert.match(testBlockReason({ configured: false, ownDeviceCount: 1 }), /credentials/);
  assert.match(testBlockReason({ configured: true, ownDeviceCount: 0 }), /own iPhones/);
  assert.equal(testBlockReason({ configured: true, ownDeviceCount: 1 }), '');
});

test('server rejection details remain available for validation, conflicts and rate limits', () => {
  for (const status of [400, 403, 409, 429, 503]) {
    assert.deepEqual(errInfo({ status, data: { message: 'Server explanation' } }), { status, message: 'Server explanation' });
  }
  assert.equal(errInfo(new Error('Offline')).message, 'Offline');
});

test('placeholder insertion preserves the server-supported brace syntax', () => {
  assert.equal(placeholderToken('eventName'), '{eventName}');
  assert.equal(placeholderToken('amount'), '{amount}');
});
