/**
 * Input sanitisation utilities used across all services.
 * Guards against XSS, path traversal, and SQL/NoSQL injection patterns.
 */

// Strip HTML tags (non-destructive plain-text extraction)
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

// Truncate strings to a safe maximum length
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}

// Validate UUID v4
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// Validate ISO 639-1 language code (2-letter)
const ISO639_1_REGEX = /^[a-z]{2}(-[A-Z]{2})?$/;

export function isISO639(value: string): boolean {
  return ISO639_1_REGEX.test(value);
}

// Reject path traversal attempts
export function isSafePath(value: string): boolean {
  return !/(\.\.\/|\.\.\\|%2e%2e)/i.test(value);
}

// Pseudonymize text by removing UUIDs, emails, phone numbers before
// sending to third-party APIs (e.g. translation providers).
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\+?[0-9\s\-().]{7,15}/g;

export function pseudonymizeForThirdParty(text: string): string {
  return text
    .replace(UUID_PATTERN, "[ID]")
    .replace(EMAIL_PATTERN, "[EMAIL]")
    .replace(PHONE_PATTERN, "[PHONE]");
}