import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { transform } from "esbuild";

async function moduleFrom(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transform(source, { loader: "ts", format: "esm", target: "node22" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const catalog = await moduleFrom("./catalog.ts");
const apns = await moduleFrom("./apns.ts");
for (const type of ["event_created", "event_changed", "event_cancelled", "flare_gun", "event_reminder", "payment_reminder", "payment_required", "payment_authorization_required", "payment_captured", "payment_failed"]) {
  test(`supported trigger ${type}`, () => assert.equal(catalog.canonicalTrigger(type), type));
}
test("legacy aliases route to supported triggers, unknown types do not broadcast", () => {
  assert.equal(catalog.canonicalTrigger("new_event"), "event_created");
  assert.equal(catalog.canonicalTrigger("event_update"), "event_changed");
  assert.equal(catalog.canonicalTrigger("system"), undefined);
});
test("render all documented variables", () => {
  const result = catalog.renderTemplate(catalog.PLACEHOLDERS.map(p => `{${p}}`).join("|"), catalog.SAMPLE_CONTEXT);
  assert.equal(result, catalog.PLACEHOLDERS.map(p => catalog.SAMPLE_CONTEXT[p]).join("|"));
});
test("placeholder values are not evaluated a second time", () => {
  assert.equal(catalog.renderTemplate("{eventName}", { ...catalog.SAMPLE_CONTEXT, eventName: "{amount}" }), "{amount}");
});
for (const value of ["{unknown}", "{constructor}", "unfinished {eventName", "{{eventName}}"]) {
  test(`reject unsafe/malformed placeholder ${value}`, () => assert.throws(() => catalog.validateTemplateText(value)));
}
test("no native push without explicit opt-in", () => {
  assert.equal(catalog.pushPreferenceAllows("event_created", undefined), false);
  assert.equal(catalog.pushPreferenceAllows("payment_captured", { pushNotificationsIOS: false }), false);
});
test("all category opt-outs are respected for push, including payments", () => {
  const prefs = { pushNotificationsIOS: true, newEvents: false, eventChanges: false, paymentReminders: false, flareGunReminders: false };
  for (const key of ["event_created", "event_changed", "event_cancelled", "payment_required", "payment_reminder", "payment_failed", "flare_gun"]) {
    assert.equal(catalog.pushPreferenceAllows(key, prefs), false);
  }
});
test("flare requires separate opt-in; self-tests require global opt-in", () => {
  assert.equal(catalog.pushPreferenceAllows("flare_gun", { pushNotificationsIOS: true }), false);
  assert.equal(catalog.pushPreferenceAllows("flare_gun", { pushNotificationsIOS: true, flareGunReminders: true }), true);
  assert.equal(catalog.pushPreferenceAllows("test", { pushNotificationsIOS: true }), true);
});
for (const status of [0, 429, 500, 503]) {
  test(`APNs ${status} is retryable`, () => assert.equal(apns.classifyApnsResponse(status, "TemporaryFailure").retryable, true));
}
for (const reason of ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"]) {
  test(`APNs ${reason} disables the invalid device`, () => assert.equal(apns.classifyApnsResponse(400, reason).invalidDevice, true));
}
test("Apple acceptance is distinct from retry and device invalidation", () => {
  assert.deepEqual(apns.classifyApnsResponse(200, "Accepted by Apple"), { accepted: true, retryable: false, invalidDevice: false });
  assert.equal(apns.classifyApnsResponse(403, "InvalidProviderToken").retryable, false);
  assert.equal(apns.classifyApnsResponse(403, "ExpiredProviderToken").retryable, true);
});
test("configuration checks reject missing and invalid keys without exposing values", async () => {
  const keys = ["APNS_PRIVATE_KEY", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_SANDBOX_PRIVATE_KEY"];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(apns.apnsConfiguration().configured, false);
    process.env.APNS_PRIVATE_KEY = "not a private key";
    process.env.APNS_KEY_ID = "TESTKEY123";
    process.env.APNS_TEAM_ID = "TESTTEAM12";
    assert.equal(apns.apnsConfiguration().configured, false);
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    process.env.APNS_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
    assert.equal(apns.apnsConfiguration().configured, true);
    // Payload rejection happens before any connection to Apple's servers.
    const result = await apns.sendApplePush({
      id: "00000000-0000-4000-8000-000000000000", token: "a".repeat(64), environment: "production",
      title: "Oversized", body: "x".repeat(5000), data: {}, expiresAt: new Date(Date.now() + 60000),
    });
    assert.equal(result.reason, "PayloadTooLarge");
  } finally {
    for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});