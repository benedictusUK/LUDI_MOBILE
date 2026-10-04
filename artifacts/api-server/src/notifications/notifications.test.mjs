import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync, createPrivateKey, sign, verify } from "node:crypto";
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
test("APNs validator accepts standard PKCS8 P-256 PEM formats and rejects the wrong curve", () => {
  const keys = ["APNS_PRIVATE_KEY", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_SANDBOX_PRIVATE_KEY"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    delete process.env.APNS_SANDBOX_PRIVATE_KEY;
    process.env.APNS_KEY_ID = "TESTKEY123";
    process.env.APNS_TEAM_ID = "TESTTEAM12";
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    for (const [format, value] of [
      ["multiline PEM", pem],
      ["Windows line endings", pem.replace(/\n/g, "\r\n")],
      ["escaped newlines", pem.replace(/\n/g, "\\n")],
      ["escaped Windows line endings", pem.replace(/\n/g, "\\r\\n")],
      ["surrounding whitespace", `\n${pem}\n`],
      ["flattened PEM lines", pem.replace(/\n/g, "")],
      ["space-separated PEM lines", pem.replace(/\n/g, " ")],
    ]) {
      process.env.APNS_PRIVATE_KEY = value;
      assert.equal(apns.apnsConfiguration("production").configured, true, format);
      assert.equal(apns.apnsConfiguration("sandbox").configured, true, format);
    }
    const wrongCurve = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
    process.env.APNS_PRIVATE_KEY = wrongCurve.privateKey.export({ type: "pkcs8", format: "pem" });
    assert.equal(apns.apnsConfiguration().configured, false);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
test("flattened PEM remains the same signing key after normalization", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const normalized = apns.normalizeApnsPrivateKey(pem.replace(/\n/g, ""));
  const restored = createPrivateKey(normalized);
  assert.deepEqual(restored.export({ type: "pkcs8", format: "der" }), privateKey.export({ type: "pkcs8", format: "der" }));
  const payload = Buffer.from("APNs normalization signing regression");
  const signature = sign("sha256", payload, { key: restored, dsaEncoding: "ieee-p1363" });
  assert.equal(verify("sha256", payload, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature), true);
  const damaged = pem.replace(/\n/g, "").replace("-----END PRIVATE KEY-----", "!-----END PRIVATE KEY-----");
  assert.throws(() => createPrivateKey(apns.normalizeApnsPrivateKey(damaged)));
});