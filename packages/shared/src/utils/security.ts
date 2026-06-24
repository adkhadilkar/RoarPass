/**
 * Security utility helpers — shared across services.
 * NO secrets are stored here; only validation and sanitisation helpers.
 */

/**
 * Check if a set of JWT claims contains a required role.
 * Used in middleware and API route guards.
 */
export function hasRole(claims: JwtClaims, required: SecurityRole): boolean {
  return claims.roles.includes(required);
}

/**
 * Check if a set of JWT claims contains ALL required roles.
 */
export function hasAllRoles(claims: JwtClaims, required: SecurityRole[]): boolean {
  return required.every((r) => claims.roles.includes(r));
}

/**
 * Sanitise a string for safe logging — strips potential PII patterns.
 * NOT a substitute for proper PII tokenisation on LLM boundaries.
 */
export function sanitiseForLog(input: string): string {
  return input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b\+?[0-9]{7,15}\b/g, '[phone]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]');
}

/**
 * Check for common prompt injection patterns.
 * Returns true if injection is suspected; callers MUST log and neutralise.
 */
export function detectPromptInjection(userInput: string): boolean {
  const patterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(your\s+)?system\s+prompt/i,
    /you\s+are\s+now\s+a\s+different\s+(ai|assistant|model)/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /reveal\s+(your\s+)?(system\s+prompt|instructions|api\s+key)/i,
    /act\s+as\s+(if\s+you\s+are\s+)?(?!a\s+helpful)/i,
  ];
  return patterns.some((p) => p.test(userInput));
}

/**
 * Validate that a string is a safe ISO 639-1 language code.
 */
export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code);
}

/**
 * Validate UUID v4 format.
 */
export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}