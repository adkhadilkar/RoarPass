/**
 * Centralised environment variable accessor.
 * - NEVER import process.env directly elsewhere.
 * - NEVER log return values.
 * - Throws at startup if required vars are missing (fail-fast).
 */

const REQUIRED_VARS = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "JWT_AUDIENCE",
  "JWT_EXPIRES_IN",
  // Translation service
  "DEEPL_API_KEY_SECRET_ARN",   // AWS Secrets Manager ARN — never the raw key
  "GOOGLE_TRANSLATE_API_KEY_SECRET_ARN",
  // AI Gateway
  "AI_GATEWAY_URL",
  "AI_GATEWAY_API_KEY_SECRET_ARN",
  // Storage / CDN
  "CDN_BASE_URL",
  "S3_BUCKET_DATA_EXPORT",
  // Internal service mesh
  "INTERNAL_SERVICE_SECRET_ARN",
  // CORS
  "ALLOWED_ORIGINS",
] as const;

type RequiredVar = typeof REQUIRED_VARS[number];

const _cache: Partial<Record<string, string>> = {};

export function getEnv(key: RequiredVar | string): string {
  if (_cache[key] !== undefined) return _cache[key]!;
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
  _cache[key] = value;
  return value;
}

export function getOptionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/** Call once on startup to validate all required env vars exist. */
export function validateEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}