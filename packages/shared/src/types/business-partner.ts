import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const PartnerCategoryEnum = z.enum([
  'RESTAURANT',
  'BAR_NIGHTCLUB',
  'ACCOMMODATION',
  'TRANSPORT',
  'TOUR_GUIDE',
  'RETAIL',
  'SPORTS_GEAR',
  'MONEY_EXCHANGE',
  'HEALTH_PHARMACY',
  'ENTERTAINMENT',
  'OTHER',
]);
export type PartnerCategory = z.infer<typeof PartnerCategoryEnum>;

export const PartnerStatusEnum = z.enum([
  'PENDING_VERIFICATION',
  'VERIFIED',
  'SUSPENDED',
  'REJECTED',
]);
export type PartnerStatus = z.infer<typeof PartnerStatusEnum>;

export const SponsoredPlacementTypeEnum = z.enum([
  'FEATURED_LISTING',
  'CATEGORY_BANNER',
  'SEARCH_BOOST',
]);
export type SponsoredPlacementType = z.infer<typeof SponsoredPlacementTypeEnum>;

export const BookingStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const DiscountTypeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);
export type DiscountType = z.infer<typeof DiscountTypeEnum>;

export const VerificationTierEnum = z.enum([
  'UNVERIFIED',
  'BASIC',
  'VERIFIED',
  'PREMIUM_PARTNER',
]);
export type VerificationTier = z.infer<typeof VerificationTierEnum>;

// ─────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────

export const BusinessPartnerSchema = z.object({
  partnerId: z.string().uuid(),
  ownerId: z.string().uuid(), // FK → Fan Profile / user identity
  businessName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  categories: z.array(PartnerCategoryEnum).min(1).max(5),
  countryCode: z.string().length(2), // ISO 3166-1 alpha-2
  cityId: z.string().uuid(),
  addressLine1: z.string().max(300),
  addressLine2: z.string().max(300).optional(),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phoneNumber: z.string().max(30).optional(),
  websiteUrl: z.string().url().optional(),
  status: PartnerStatusEnum,
  verificationTier: VerificationTierEnum,
  /** ISO 639-1 codes for languages the business can serve */
  supportedLanguages: z.array(z.string().length(2)).min(1),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  suspendedAt: z.string().datetime().optional(),
  suspensionReason: z.string().max(500).optional(),
});
export type BusinessPartner = z.infer<typeof BusinessPartnerSchema>;

// ─────────────────────────────────────────────
// Native-language menu / description
// ─────────────────────────────────────────────

export const MenuItemSchema = z.object({
  itemId: z.string().uuid(),
  partnerId: z.string().uuid(),
  /** ISO 639-1 language of this translation */
  language: z.string().length(2),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currencyCode: z.string().length(3), // ISO 4217
  imageUrl: z.string().url().optional(),
  isHalal: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

// ─────────────────────────────────────────────
// Fan discount / offer
// ─────────────────────────────────────────────

export const FanDiscountSchema = z.object({
  discountId: z.string().uuid(),
  partnerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  discountType: DiscountTypeEnum,
  discountValue: z.number().positive(),
  /** ISO 4217; only required for FIXED_AMOUNT */
  currencyCode: z.string().length(3).optional(),
  minGroupSize: z.number().int().min(1).default(1),
  maxGroupSize: z.number().int().min(1).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  promoCode: z.string().max(50).optional(),
  /** Limit total redemptions; null = unlimited */
  maxRedemptions: z.number().int().positive().optional(),
  currentRedemptions: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  /** Restrict to specific event */
  eventId: z.string().uuid().optional(),
  /** Restrict to specific community / country */
  communityId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FanDiscount = z.infer<typeof FanDiscountSchema>;

// ─────────────────────────────────────────────
// Group booking
// ─────────────────────────────────────────────

export const GroupBookingSchema = z.object({
  bookingId: z.string().uuid(),
  partnerId: z.string().uuid(),
  organizerUserId: z.string().uuid(),
  discountId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  groupName: z.string().max(200).optional(),
  partySize: z.number().int().min(1).max(500),
  bookingDate: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  status: BookingStatusEnum,
  totalAmountCents: z.number().int().nonnegative().optional(),
  currencyCode: z.string().length(3).optional(),
  confirmationCode: z.string().max(50).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupBooking = z.infer<typeof GroupBookingSchema>;

// ─────────────────────────────────────────────
// Sponsored placement
// ─────────────────────────────────────────────

export const SponsoredPlacementSchema = z.object({
  placementId: z.string().uuid(),
  partnerId: z.string().uuid(),
  placementType: SponsoredPlacementTypeEnum,
  /** null = global; otherwise scoped to event */
  eventId: z.string().uuid().optional(),
  /** null = global; otherwise scoped to community */
  communityId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budgetCents: z.number().int().positive(),
  spentCents: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  /** CPC or CPM config if needed */
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SponsoredPlacement = z.infer<typeof SponsoredPlacementSchema>;

// ─────────────────────────────────────────────
// API request / response shapes
// ─────────────────────────────────────────────

export const CreatePartnerRequestSchema = z.object({
  businessName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  categories: z.array(PartnerCategoryEnum).min(1).max(5),
  countryCode: z.string().length(2),
  cityId: z.string().uuid(),
  addressLine1: z.string().min(1).max(300),
  addressLine2: z.string().max(300).optional(),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phoneNumber: z.string().max(30).optional(),
  websiteUrl: z.string().url().optional(),
  supportedLanguages: z.array(z.string().length(2)).min(1),
});
export type CreatePartnerRequest = z.infer<typeof CreatePartnerRequestSchema>;

export const UpdatePartnerRequestSchema = CreatePartnerRequestSchema.partial();
export type UpdatePartnerRequest = z.infer<typeof UpdatePartnerRequestSchema>;

export const CreateMenuItemRequestSchema = z.object({
  language: z.string().length(2),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currencyCode: z.string().length(3),
  imageUrl: z.string().url().optional(),
  isHalal: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type CreateMenuItemRequest = z.infer<typeof CreateMenuItemRequestSchema>;

export const CreateDiscountRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  discountType: DiscountTypeEnum,
  discountValue: z.number().positive(),
  currencyCode: z.string().length(3).optional(),
  minGroupSize: z.number().int().min(1).optional(),
  maxGroupSize: z.number().int().min(1).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  promoCode: z.string().max(50).optional(),
  maxRedemptions: z.number().int().positive().optional(),
  eventId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
});
export type CreateDiscountRequest = z.infer<typeof CreateDiscountRequestSchema>;

export const CreateGroupBookingRequestSchema = z.object({
  partnerId: z.string().uuid(),
  discountId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  groupName: z.string().max(200).optional(),
  partySize: z.number().int().min(1).max(500),
  bookingDate: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});
export type CreateGroupBookingRequest = z.infer<typeof CreateGroupBookingRequestSchema>;

export const CreateSponsoredPlacementRequestSchema = z.object({
  placementType: SponsoredPlacementTypeEnum,
  eventId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budgetCents: z.number().int().positive(),
});
export type CreateSponsoredPlacementRequest = z.infer<typeof CreateSponsoredPlacementRequestSchema>;

export const PartnerListQuerySchema = z.object({
  category: PartnerCategoryEnum.optional(),
  countryCode: z.string().length(2).optional(),
  cityId: z.string().uuid().optional(),
  language: z.string().length(2).optional(),
  status: PartnerStatusEnum.optional(),
  eventId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
  sponsored: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});
export type PartnerListQuery = z.infer<typeof PartnerListQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}