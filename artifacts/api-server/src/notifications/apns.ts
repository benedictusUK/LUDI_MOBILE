import { createPrivateKey, sign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";

export type AppleEnvironment = "sandbox" | "production";
export function normalizeApnsPrivateKey(value: string) {
  const normalized = value.replace(/\\r\\n|\\n|\\r/g, "\n").trim();
  // Secret entry/transport can flatten PEM lines. Rebuild only the whitespace
  // around an intact PKCS8 base64 body; cryptographic validation still follows.
  const match = normalized.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!match) return normalized;
  const body = match[1].replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return normalized;
  const lines = body.match(/.{1,64}/g)!;
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}
export function apnsConfiguration(environment: AppleEnvironment = "production") {
  const prefix = environment === "sandbox" && process.env.APNS_SANDBOX_PRIVATE_KEY ? "APNS_SANDBOX_" : "APNS_";
  const keyId = process.env[`${prefix}KEY_ID`];
  const rawPrivateKey = process.env[`${prefix}PRIVATE_KEY`];
  const privateKey = rawPrivateKey ? normalizeApnsPrivateKey(rawPrivateKey) : undefined;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || "app.replit.ludi";
  const missing = [
    !keyId && `${prefix}KEY_ID`, !privateKey && `${prefix}PRIVATE_KEY`, !teamId && "APNS_TEAM_ID",
  ].filter((v): v is string => !!v);
  let validKey = !missing.length;
  if (validKey) {
    try {
      const parsed = createPrivateKey(privateKey!);
      validKey = parsed.asymmetricKeyType === "ec" && parsed.asymmetricKeyDetails?.namedCurve === "prime256v1";
    } catch { validKey = false; }
    if (!validKey) missing.push("Valid Apple APNs ES256 private key");
  }
  return { configured: !missing.length && validKey, missing, bundleId, keyId, privateKey, teamId };
}

const authCache = new Map<string, { value: string; expires: number; key: string }>();
function authorization(environment: AppleEnvironment): string {
  const config = apnsConfiguration(environment);
  if (!config.configured) throw new Error("APNsNotConfigured");
  const cache = authCache.get(environment);
  if (cache && cache.expires > Date.now() && cache.key === config.privateKey) return cache.value;
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const content = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(content), {
    key: config.privateKey!, dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const value = `${content}.${signature}`;
  authCache.set(environment, { value, expires: Date.now() + 45 * 60_000, key: config.privateKey! });
  return value;
}

const sessions = new Map<AppleEnvironment, ClientHttp2Session>();
function sessionFor(environment: AppleEnvironment) {
  let session = sessions.get(environment);
  if (!session || session.destroyed || session.closed) {
    session = connect(environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
    const current = session;
    session.on("error", () => { current.destroy(); if (sessions.get(environment) === current) sessions.delete(environment); });
    session.on("goaway", () => { current.close(); if (sessions.get(environment) === current) sessions.delete(environment); });
    sessions.set(environment, session);
  }
  return session;
}
export function classifyApnsResponse(status: number, reason: string) {
  return {
    accepted: status === 200,
    retryable: status === 0 || status === 429 || status >= 500 || reason === "ExpiredProviderToken",
    invalidDevice: status === 410 || ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(reason),
  };
}
export async function sendApplePush(input: {
  id: string; token: string; environment: AppleEnvironment; title: string; body: string;
  data: Record<string, string>; expiresAt: Date;
}) {
  const config = apnsConfiguration(input.environment);
  const bearer = authorization(input.environment);
  const payload = JSON.stringify({
    aps: { alert: { title: input.title, body: input.body }, sound: "default" },
    ...input.data,
  });
  if (Buffer.byteLength(payload) > 4096) return { status: 413, reason: "PayloadTooLarge" };
  return new Promise<{ status: number; reason: string }>((resolve, reject) => {
    const session = sessionFor(input.environment);
    const request = session.request({
      ":method": "POST", ":path": `/3/device/${input.token}`, authorization: `bearer ${bearer}`,
      "apns-topic": config.bundleId, "apns-push-type": "alert", "apns-priority": "10",
      "apns-id": input.id, "apns-expiration": String(Math.floor(input.expiresAt.getTime() / 1000)),
      "apns-collapse-id": input.id,
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    const timeout = setTimeout(() => { request.close(); reject(new Error("APNsRequestTimeout")); }, 15_000);
    request.setEncoding("utf8");
    request.on("response", headers => { status = Number(headers[":status"]); });
    request.on("data", chunk => { if (body.length < 4096) body += chunk; });
    request.on("error", () => { clearTimeout(timeout); reject(new Error("APNsConnectionError")); });
    request.on("end", () => {
      clearTimeout(timeout);
      let reason = status === 200 ? "Accepted by Apple" : "APNsRejected";
      try { reason = JSON.parse(body).reason || reason; } catch { /* Non-JSON Apple response. */ }
      if (reason === "ExpiredProviderToken") authCache.delete(input.environment);
      resolve({ status, reason });
    });
    request.end(payload);
  });
}