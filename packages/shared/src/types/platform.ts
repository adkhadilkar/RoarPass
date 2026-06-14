import { z } from "zod";

// ─── Core platform types ───────────────────────────────────────────────────

export const SupportedLocale = z.enum([
  "en", "ar", "fr", "es", "pt", "ja", "ko", "hi", "ur",
  "zh", "de", "it", "nl", "ru", "tr", "he", "fa", "th", "vi", "pl",
]);
export type SupportedLocale = z.infer<typeof SupportedLocale>;

export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set([
  "ar", "he", "ur", "fa",
]);

export function isRTL(locale: string): boolean {
  return RTL_LOCALES.has(locale as SupportedLocale);
}

export const UserRole = z.enum([
  "fan", "local_helper", "moderator", "business_partner", "admin", "super_admin",
]);
export type UserRole = z.infer<typeof UserRole>;

export const ConsentPurpose = z.enum([
  "essential",
  "analytics",
  "marketing",
  "ai_assistant",
  "translation_third_party",
  "push_notifications",
  "location",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const ConsentRecord = z.object({
  user_id: z.string().uuid(),
  purpose: ConsentPurpose,
  granted: z.boolean(),
  granted_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  ip_address_hash: z.string(), // hashed – never store raw IP beyond transit
  user_agent: z.string().max(512),
  version: z.string(), // consent text version
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

export const DataDeletionRequest = z.object({
  request_id: z.string().uuid(),
  user_id: z.string().uuid(),
  requested_at: z.string().datetime(),
  regulation: z.enum(["GDPR", "CCPA", "PDPA"]),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  completed_at: z.string().datetime().nullable(),
  systems_deleted: z.array(z.string()),
  requested_by_ip_hash: z.string(),
});
export type DataDeletionRequest = z.infer<typeof DataDeletionRequest>;

export const DataExportRequest = z.object({
  request_id: z.string().uuid(),
  user_id: z.string().uuid(),
  requested_at: z.string().datetime(),
  status: z.enum(["pending", "processing", "ready", "downloaded", "expired"]),
  download_url: z.string().url().nullable(),
  expires_at: z.string().datetime().nullable(),
  regulation: z.enum(["GDPR", "CCPA", "PDPA"]),
});
export type DataExportRequest = z.infer<typeof DataExportRequest>;

export const JWTPayload = z.object({
  sub: z.string().uuid(),          // user_id
  roles: z.array(UserRole),
  iss: z.literal("roarpass"),
  aud: z.string(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string().uuid(),          // JWT ID for revocation
  locale: SupportedLocale.optional(),
  verification_tier: z.number().int().min(0).max(3).optional(),
});
export type JWTPayload = z.infer<typeof JWTPayload>;

// Security headers config shape (used in Next.js + Express)
export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  strictTransportSecurity: string;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: string;
  crossOriginOpenerPolicy: string;
  crossOriginResourcePolicy: string;
}