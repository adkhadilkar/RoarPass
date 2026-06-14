import { createHash, randomBytes } from "crypto";

/**
 * Deterministic SHA-256 hash of a string (for audit log integrity, cache keys, etc.)
 * Returns hex string. Never used for passwords.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generate a cryptographically secure random token (e.g., for JTI / CSRF tokens).
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Hash a user IP address for storage (GDPR: avoid storing raw IPs).
 */
export function hashIp(ip: string, salt: string): string {
  return sha256(`${salt}:${ip}`);
}