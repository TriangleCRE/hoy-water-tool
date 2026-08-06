// Shared-passcode session helpers.
//
// There is no session store and no user database: the cookie itself IS the
// session. It carries an issue timestamp plus an HMAC-SHA256 signature keyed
// off the PASSCODE env var, so it can be verified statelessly on every
// request. Changing PASSCODE invalidates every outstanding session.

import crypto from "node:crypto";

export const COOKIE_NAME = "session";
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

function secret() {
  const value = process.env.PASSCODE;
  if (!value) {
    throw new Error("PASSCODE environment variable is not set");
  }
  return value;
}

function hmac(input) {
  return crypto.createHmac("sha256", secret()).update(input).digest("base64url");
}

// Constant-time comparison for strings of arbitrary (and differing) length.
// Hashing both sides first means crypto.timingSafeEqual always receives
// equal-length buffers, so the comparison never short-circuits on length.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return ha.length === hb.length && crypto.timingSafeEqual(ha, hb);
}

export function checkPasscode(candidate) {
  return typeof candidate === "string" && candidate.length > 0 && safeEqual(candidate, secret());
}

export function makeSessionCookieValue() {
  const payload = String(Date.now());
  return `${payload}.${hmac(payload)}`;
}

export function isValidSessionCookie(value) {
  if (!value || !value.includes(".")) return false;
  const i = value.lastIndexOf(".");
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  if (!safeEqual(sig, hmac(payload))) return false;
  const issuedAt = Number(payload);
  return Number.isFinite(issuedAt) && Date.now() - issuedAt < MAX_AGE_MS;
}
