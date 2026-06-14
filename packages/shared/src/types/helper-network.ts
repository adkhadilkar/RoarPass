import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum HelperOfferingCategory {
  AIRPORT_PICKUP = 'AIRPORT_PICKUP',
  LOCAL_GUIDE = 'LOCAL_GUIDE',
  TRANSLATION = 'TRANSLATION',
  ACCOMMODATION_TIPS = 'ACCOMMODATION_TIPS',
  STADIUM_ESCORT = 'STADIUM_ESCORT',
  TRANSPORT_HELP = 'TRANSPORT_HELP',
  FOOD_RECOMMENDATIONS = 'FOOD_RECOMMENDATIONS',
  EMERGENCY_SUPPORT = 'EMERGENCY_SUPPORT',
  VISA_ADVICE = 'VISA_ADVICE',
  CULTURAL_ORIENTATION = 'CULTURAL_ORIENTATION',
}

export enum HelperRequestStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum HelperAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

export enum OfferingType {
  FREE = 'FREE',
  PAID = 'PAID',
}

export enum VerificationTier {
  UNVERIFIED = 'UNVERIFIED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  ID_VERIFIED = 'ID_VERIFIED',
  COMMUNITY_TRUSTED = 'COMMUNITY_TRUSTED',
  OFFICIAL_HELPER = 'OFFICIAL_HELPER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum RatingCategory {
  OVERALL = 'OVERALL',
  COMMUNICATION = 'COMMUNICATION',
  RELIABILITY = 'RELIABILITY',
  KNOWLEDGE = 'KNOWLEDGE',
  VALUE = 'VALUE',
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const HelperOfferingSchema = z.object({
  offering_id: z.string().uuid(),
  helper_id: z.string().uuid(),
  category: z.nativeEnum(HelperOfferingCategory),
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  offering_type: z.nativeEnum(OfferingType),
  price_amount: z.number().min(0).max(10000).nullable(), // null for FREE
  price_currency: z.string().length(3).nullable(), // ISO 4217
  commission_rate: z.number().min(0).max(1).default(0.15), // platform commission %
  max_group_size: z.number().int().min(1).max(50).default(1),
  duration_minutes: z.number().int().min(15).max(1440).optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const HelperAvailabilitySlotSchema = z.object({
  slot_id: z.string().uuid(),
  helper_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  start_time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM UTC
  end_time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM UTC
  is_booked: z.boolean().default(false),
  event_id: z.string().uuid().optional(),
});

export const HelperProfileSchema = z.object({
  helper_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().min(2).max(60),
  bio: z.string().max(500).optional(),
  city_id: z.string().uuid(),
  city_name: z.string(),
  country_code: z.string().length(2), // ISO 3166-1 alpha-2
  languages_spoken: z.array(z.string().min(2).max(5)).min(1), // ISO 639-1 or BCP-47
  offering_categories: z.array(z.nativeEnum(HelperOfferingCategory)).min(1),
  verification_tier: z.nativeEnum(VerificationTier),
  is_discoverable: z.boolean().default(true),
  is_active: z.boolean().default(true),
  availability_status: z.nativeEnum(HelperAvailabilityStatus),
  average_rating: z.number().min(0).max(5).nullable(),
  total_reviews: z.number().int().min(0).default(0),
  total_requests_completed: z.number().int().min(0).default(0),
  event_ids: z.array(z.string().uuid()), // events helper is active for
  profile_photo_url: z.string().url().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateHelperProfileSchema = z.object({
  display_name: z.string().min(2).max(60),
  bio: z.string().max(500).optional(),
  city_id: z.string().uuid(),
  languages_spoken: z.array(z.string().min(2).max(5)).min(1).max(10),
  offering_categories: z.array(z.nativeEnum(HelperOfferingCategory)).min(1),
  event_ids: z.array(z.string().uuid()).min(1),
});

export const UpdateHelperProfileSchema = z.object({
  display_name: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).optional(),
  languages_spoken: z.array(z.string().min(2).max(5)).min(1).max(10).optional(),
  offering_categories: z.array(z.nativeEnum(HelperOfferingCategory)).min(1).optional(),
  is_discoverable: z.boolean().optional(),
  availability_status: z.nativeEnum(HelperAvailabilityStatus).optional(),
  event_ids: z.array(z.string().uuid()).optional(),
});

export const HelperRequestSchema = z.object({
  request_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  helper_id: z.string().uuid().optional().nullable(), // null until matched
  event_id: z.string().uuid(),
  category: z.nativeEnum(HelperOfferingCategory),
  offering_id: z.string().uuid().optional().nullable(),
  message: z.string().min(10).max(500),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requested_time_utc: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.nativeEnum(HelperRequestStatus),
  payment_status: z.nativeEnum(PaymentStatus).nullable(),
  payment_amount: z.number().min(0).nullable(),
  payment_currency: z.string().length(3).nullable(),
  conversation_id: z.string().uuid().optional().nullable(), // ref to messaging-realtime
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateHelperRequestSchema = z.object({
  event_id: z.string().uuid(),
  category: z.nativeEnum(HelperOfferingCategory),
  offering_id: z.string().uuid().optional(),
  helper_id: z.string().uuid().optional(), // direct request to specific helper
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(500, 'Message must not exceed 500 characters')
    .refine(
      (v) => !/<script|javascript:|on\w+=/i.test(v),
      'Message contains invalid content'
    ),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  requested_time_utc: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const HelperRatingSchema = z.object({
  rating_id: z.string().uuid(),
  request_id: z.string().uuid(),
  helper_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  overall_score: z.number().int().min(1).max(5),
  category_scores: z.record(z.nativeEnum(RatingCategory), z.number().int().min(1).max(5)).optional(),
  review_text: z.string().max(1000).optional().nullable(),
  is_anonymous: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  created_at: z.string().datetime(),
});

export const CreateRatingSchema = z.object({
  overall_score: z.number().int().min(1).max(5),
  category_scores: z
    .record(z.nativeEnum(RatingCategory), z.number().int().min(1).max(5))
    .optional(),
  review_text: z
    .string()
    .max(1000)
    .optional()
    .refine(
      (v) => !v || !/<script|javascript:|on\w+=/i.test(v),
      'Review contains invalid content'
    ),
  is_anonymous: z.boolean().default(false),
});

export const HelperSearchParamsSchema = z.object({
  event_id: z.string().uuid().optional(),
  city_id: z.string().uuid().optional(),
  category: z.nativeEnum(HelperOfferingCategory).optional(),
  language: z.string().min(2).max(5).optional(),
  offering_type: z.nativeEnum(OfferingType).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  min_rating: z.number().min(0).max(5).optional(),
  min_verification_tier: z.nativeEnum(VerificationTier).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type HelperOffering = z.infer<typeof HelperOfferingSchema>;
export type HelperAvailabilitySlot = z.infer<typeof HelperAvailabilitySlotSchema>;
export type HelperProfile = z.infer<typeof HelperProfileSchema>;
export type CreateHelperProfile = z.infer<typeof CreateHelperProfileSchema>;
export type UpdateHelperProfile = z.infer<typeof UpdateHelperProfileSchema>;
export type HelperRequest = z.infer<typeof HelperRequestSchema>;
export type CreateHelperRequest = z.infer<typeof CreateHelperRequestSchema>;
export type HelperRating = z.infer<typeof HelperRatingSchema>;
export type CreateRating = z.infer<typeof CreateRatingSchema>;
export type HelperSearchParams = z.infer<typeof HelperSearchParamsSchema>;

export interface HelperProfileWithOfferings extends HelperProfile {
  offerings: HelperOffering[];
  upcoming_availability: HelperAvailabilitySlot[];
}

export interface HelperRequestWithDetails extends HelperRequest {
  helper?: Pick<HelperProfile, 'helper_id' | 'display_name' | 'profile_photo_url' | 'verification_tier' | 'average_rating'>;
  offering?: Pick<HelperOffering, 'title' | 'offering_type' | 'price_amount' | 'price_currency'>;
}

export interface HelperNetworkStats {
  total_helpers: number;
  active_requests: number;
  completed_requests: number;
  average_rating_platform: number;
}

// Commission calculation helper
export function calculateCommission(amount: number, rate: number): {
  platform_fee: number;
  helper_payout: number;
} {
  const platform_fee = Math.round(amount * rate * 100) / 100;
  return {
    platform_fee,
    helper_payout: Math.round((amount - platform_fee) * 100) / 100,
  };
}

// Required verification tier to become a helper
export const HELPER_MIN_VERIFICATION_TIER = VerificationTier.EMAIL_VERIFIED;

// Verification tier ordering for comparison
export const VERIFICATION_TIER_ORDER: Record<VerificationTier, number> = {
  [VerificationTier.UNVERIFIED]: 0,
  [VerificationTier.EMAIL_VERIFIED]: 1,
  [VerificationTier.ID_VERIFIED]: 2,
  [VerificationTier.COMMUNITY_TRUSTED]: 3,
  [VerificationTier.OFFICIAL_HELPER]: 4,
};

export function meetsMinVerificationTier(
  userTier: VerificationTier,
  requiredTier: VerificationTier
): boolean {
  return VERIFICATION_TIER_ORDER[userTier] >= VERIFICATION_TIER_ORDER[requiredTier];
}