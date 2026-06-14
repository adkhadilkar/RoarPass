import { z } from "zod";

// ─────────────────────────────────────────────
// Locale & i18n
// ─────────────────────────────────────────────

export const RTL_LANGUAGES = ["ar", "he", "ur", "fa"] as const;
export type RTLLanguage = (typeof RTL_LANGUAGES)[number];

export const SUPPORTED_LANGUAGES = [
  "en", "ar", "fr", "es", "pt", "ja", "ko", "hi", "ur",
  "zh", "de", "it", "nl", "ru", "tr", "pl", "sv", "he",
  "fa", "th",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isRTL(lang: string): lang is RTLLanguage {
  return (RTL_LANGUAGES as readonly string[]).includes(lang);
}

export const LocaleSchema = z.enum(SUPPORTED_LANGUAGES);

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string;
}

// ─────────────────────────────────────────────
// Standard Error Envelope
// ─────────────────────────────────────────────

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "TRANSLATION_SUPPRESSED_OFFICIAL"
  | "PREMIUM_REQUIRED"
  | "INTERNAL_ERROR";

export interface ApiError {
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

// ─────────────────────────────────────────────
// GDPR / Privacy consent
// ─────────────────────────────────────────────

export const ConsentPurpose = z.enum([
  "ANALYTICS",
  "TRANSLATION_THIRD_PARTY",
  "AI_ITINERARY_CONTEXT",
  "AI_FEEDBACK_MODEL_IMPROVEMENT",
  "MARKETING",
  "LOCATION_TRACKING",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export interface ConsentRecord {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt?: string; // ISO 8601
  revokedAt?: string; // ISO 8601
  ipAddress?: string; // stored hashed
  userAgent?: string;
}

// ─────────────────────────────────────────────
// Roles & authz
// ─────────────────────────────────────────────

export const UserRole = z.enum([
  "FAN",
  "LOCAL_HELPER",
  "COMMUNITY_MODERATOR",
  "BUSINESS_PARTNER",
  "ADMIN",
  "SUPER_ADMIN",
]);
export type UserRole = z.infer<typeof UserRole>;

export const SubscriptionTier = z.enum(["FREE", "FAN_PREMIUM", "HELPER_PRO"]);
export type SubscriptionTier = z.infer<typeof SubscriptionTier>;

export interface JwtPayload {
  sub: string; // user UUID
  roles: UserRole[];
  subscription: SubscriptionTier;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

// ─────────────────────────────────────────────
// Rate-limit metadata (attached to responses)
// ─────────────────────────────────────────────

export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string; // Unix epoch
}