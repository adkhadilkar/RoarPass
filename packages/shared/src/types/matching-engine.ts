import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const MatchingVisibilitySchema = z.enum([
  'PUBLIC',      // visible to all fans in the event
  'COMMUNITY',   // visible to country-community members only
  'HELPERS',     // visible to verified local helpers only
  'PRIVATE',     // not discoverable
]);
export type MatchingVisibility = z.infer<typeof MatchingVisibilitySchema>;

export const MatchingSignalTypeSchema = z.enum([
  'SAME_CITY',
  'SAME_MATCH',
  'SAME_ROUTE',
  'SAME_DATES',
  'SHARED_LANGUAGE',
  'SAME_COUNTRY_COMMUNITY',
  'HELPER_MATCH',
]);
export type MatchingSignalType = z.infer<typeof MatchingSignalTypeSchema>;

export const MatchRequestStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
]);
export type MatchRequestStatus = z.infer<typeof MatchRequestStatusSchema>;

export const DiscoveryCardTypeSchema = z.enum([
  'FAN',
  'HELPER',
  'GROUP_TRIP',
]);
export type DiscoveryCardType = z.infer<typeof DiscoveryCardTypeSchema>;

// ─── Core Matching Entities ───────────────────────────────────────────────────

export const MatchingProfileSchema = z.object({
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
  visibility: MatchingVisibilitySchema,
  citiesAttending: z.array(z.string().uuid()),   // host_city_id references
  matchIds: z.array(z.string().uuid()),           // match session IDs from event-registry
  travelDates: z.object({
    arrivalDate: z.string().datetime(),
    departureDate: z.string().datetime(),
  }),
  routeCityPairs: z.array(
    z.object({
      fromCityId: z.string().uuid(),
      toCityId: z.string().uuid(),
      travelDate: z.string().datetime(),
    })
  ),
  languagesSpoken: z.array(z.string().min(2).max(3)), // ISO 639-1
  countryCommunityId: z.string().uuid().nullable(),
  isHelper: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MatchingProfile = z.infer<typeof MatchingProfileSchema>;

export const MatchingSignalSchema = z.object({
  signalId: z.string().uuid(),
  type: MatchingSignalTypeSchema,
  score: z.number().min(0).max(1),  // composite match score
  details: z.record(z.unknown()),   // e.g. { cityId, matchId, sharedLanguages }
});
export type MatchingSignal = z.infer<typeof MatchingSignalSchema>;

export const FanMatchSchema = z.object({
  matchId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  eventId: z.string().uuid(),
  signals: z.array(MatchingSignalSchema),
  compositeScore: z.number().min(0).max(1),
  computedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type FanMatch = z.infer<typeof FanMatchSchema>;

export const DiscoveryCardSchema = z.object({
  cardId: z.string().uuid(),
  type: DiscoveryCardTypeSchema,
  targetUserId: z.string().uuid().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  countryCode: z.string().length(2).nullable(),  // ISO 3166-1 alpha-2
  trustTierBadge: z.string().nullable(),         // badge label from verification-trust-tiers
  languagesSpoken: z.array(z.string()),
  matchingSignals: z.array(MatchingSignalSchema),
  compositeScore: z.number().min(0).max(1),
  sharedCities: z.array(z.string()),             // city names for display
  sharedMatches: z.array(z.string()),            // match labels for display
  isHelper: z.boolean(),
  helperOfferings: z.array(z.string()).nullable(),
  deepLinkPath: z.string(),
  generatedAt: z.string().datetime(),
});
export type DiscoveryCard = z.infer<typeof DiscoveryCardSchema>;

export const MatchRequestSchema = z.object({
  requestId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  eventId: z.string().uuid(),
  status: MatchRequestStatusSchema,
  messageText: z.string().max(500).nullable(),
  signals: z.array(MatchingSignalSchema),
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

// ─── API Request / Response DTOs ─────────────────────────────────────────────

export const UpsertMatchingProfileRequestSchema = z.object({
  eventId: z.string().uuid(),
  visibility: MatchingVisibilitySchema,
  citiesAttending: z.array(z.string().uuid()).min(1),
  matchIds: z.array(z.string().uuid()),
  travelDates: z.object({
    arrivalDate: z.string().datetime(),
    departureDate: z.string().datetime(),
  }),
  routeCityPairs: z.array(
    z.object({
      fromCityId: z.string().uuid(),
      toCityId: z.string().uuid(),
      travelDate: z.string().datetime(),
    })
  ),
});
export type UpsertMatchingProfileRequest = z.infer<typeof UpsertMatchingProfileRequestSchema>;

export const DiscoveryQuerySchema = z.object({
  eventId: z.string().uuid(),
  filters: z
    .object({
      cityId: z.string().uuid().optional(),
      matchId: z.string().uuid().optional(),
      travelDate: z.string().datetime().optional(),
      languages: z.array(z.string()).optional(),
      helpersOnly: z.boolean().optional(),
      cardType: DiscoveryCardTypeSchema.optional(),
    })
    .optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

export const DiscoveryResultSchema = z.object({
  cards: z.array(DiscoveryCardSchema),
  nextCursor: z.string().nullable(),
  totalEstimate: z.number().int(),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

export const SendMatchRequestSchema = z.object({
  toUserId: z.string().uuid(),
  eventId: z.string().uuid(),
  messageText: z.string().max(500).optional(),
});
export type SendMatchRequest = z.infer<typeof SendMatchRequestSchema>;

export const RespondMatchRequestSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
});
export type RespondMatchRequest = z.infer<typeof RespondMatchRequestSchema>;

// ─── Co-traveler signal (consumed by AI Trip Assistant) ───────────────────────

export const CoTravelerSignalSchema = z.object({
  routeKey: z.string(),   // "fromCityId:toCityId:YYYY-MM-DD"
  eventId: z.string().uuid(),
  count: z.number().int().min(0),
  sampleCountryCodes: z.array(z.string().length(2)),
  computedAt: z.string().datetime(),
});
export type CoTravelerSignal = z.infer<typeof CoTravelerSignalSchema>;