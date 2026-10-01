import { createHash, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

const HANDOFF_ISSUER = "ludi-mobile-auth";
const HANDOFF_AUDIENCE = "ludi-google-handoff";
const HANDOFF_PURPOSE = "google-mobile-handoff";
const S256_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function isValidGooglePkceChallenge(value: unknown): value is string {
  if (typeof value !== "string" || !S256_PATTERN.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length === 32 && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

export function isValidGooglePkceVerifier(value: unknown): value is string {
  return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function createGoogleMobileHandoff(
  subject: string,
  codeChallenge: string,
  secret: string,
): string {
  return jwt.sign(
    { purpose: HANDOFF_PURPOSE, codeChallenge },
    secret,
    {
      algorithm: "HS256",
      audience: HANDOFF_AUDIENCE,
      issuer: HANDOFF_ISSUER,
      subject,
      expiresIn: "60s",
    },
  );
}

export function verifyGoogleMobileHandoff(
  ticket: unknown,
  codeVerifier: unknown,
  secret: string,
): string | undefined {
  if (
    typeof ticket !== "string" ||
    ticket.length > 4096 ||
    !isValidGooglePkceVerifier(codeVerifier)
  ) {
    return undefined;
  }

  try {
    const decoded = jwt.verify(ticket, secret, {
      algorithms: ["HS256"],
      issuer: HANDOFF_ISSUER,
      audience: HANDOFF_AUDIENCE,
    });
    if (
      typeof decoded === "string" ||
      decoded.iss !== HANDOFF_ISSUER ||
      decoded.aud !== HANDOFF_AUDIENCE ||
      decoded.purpose !== HANDOFF_PURPOSE ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      Object.prototype.hasOwnProperty.call(decoded, "userId") ||
      !isValidGooglePkceChallenge(decoded.codeChallenge)
    ) {
      return undefined;
    }

    const actualChallenge = Buffer.from(pkceS256(codeVerifier), "ascii");
    const expectedChallenge = Buffer.from(decoded.codeChallenge, "ascii");
    if (
      actualChallenge.length !== expectedChallenge.length ||
      !timingSafeEqual(actualChallenge, expectedChallenge)
    ) {
      return undefined;
    }
    return decoded.sub;
  } catch {
    return undefined;
  }
}

function pkceS256(verifier: string): string {
  // PKCE S256 is SHA-256(code_verifier), base64url encoded without padding.
  return createHash("sha256").update(verifier).digest("base64url");
}