/**
 * Privacy / GDPR / CCPA / PDPA helpers.
 * Shared across backend services and used in consent-gate components.
 */

import { type ConsentRecord, type ConsentCategory, type DataSubjectRequest } from '../types/platform-foundation';

/**
 * Determine whether a user has granted consent for a specific category.
 * Consent is considered granted only if granted=true and not revoked.
 */
export function hasConsent(
  records: ConsentRecord[],
  category: ConsentCategory,
  jurisdiction?: string,
): boolean {
  const relevant = records.filter(
    (r) =>
      r.category === category &&
      (!jurisdiction || r.jurisdiction === jurisdiction),
  );
  if (relevant.length === 0) return false;
  // Use the most recently updated record
  const latest = relevant.sort((a, b) =>
    (b.grantedAt ?? b.revokedAt ?? '').localeCompare(a.grantedAt ?? a.revokedAt ?? ''),
  )[0];
  return latest.granted && !latest.revokedAt;
}

/**
 * Calculate the GDPR/CCPA deletion SLA due date.
 * GDPR: 30 days; CCPA: 45 days. Returns ISO 8601.
 */
export function calculateDeletionDueDate(submittedAt: string, jurisdiction: 'GDPR' | 'CCPA'): string {
  const days = jurisdiction === 'GDPR' ? 30 : 45;
  const date = new Date(submittedAt);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Check whether a DSR is overdue.
 */
export function isDsrOverdue(request: DataSubjectRequest): boolean {
  if (request.status === 'COMPLETED' || request.status === 'REJECTED') return false;
  return new Date() > new Date(request.dueAt);
}

/**
 * Pseudonymise a user identifier for external API calls.
 * Uses a deterministic but opaque token so the same user maps consistently
 * within a session, but cannot be reversed without the secret salt stored
 * in the secrets manager.
 *
 * NOTE: The salt MUST be loaded from env var PSEUDONYMISATION_SALT —
 * never hardcoded here.
 */
export async function pseudonymiseUserId(userId: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'anon_' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}