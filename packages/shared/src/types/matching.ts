import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum MatchType {
  FAN_TO_FAN = 'FAN_TO_FAN',
  FAN_TO_HELPER = 'FAN_TO_HELPER',
  FAN_TO_TRIP = 'FAN_TO_TRIP',
}

export enum VisibilityLevel {
  HIDDEN = 'HIDDEN',       // not discoverable
  COMMUNITY = 'COMMUNITY', // visible to same country community only
  EVENT = 'EVENT',         // visible to all event attendees
  PUBLIC = 'PUBLIC',       // fully public within platform
}

export enum MatchStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  BLOCKED = 'BLOCKED',
}

// ---------------------------------------------------------------------------
// Fan Discovery / Visibility Preferences (opt-in)
// ---------------------------------------------------------------------------

export const DiscoveryPreferencesSchema = z.object({
  userId: z.string().uuid(),
  visibilityLevel: z.nativeEnum(VisibilityLevel).default(VisibilityLevel.HIDDEN),
  shareCity: z.boolean().default(false),
  shareTravelDates: z.boolean().default(false),
  shareMatchInterests: z.boolean().default(false),
  shareLanguages: z.boolean().default(true),
  shareCountryCommunity: z.boolean().default(true),
  allowHelperSuggestions: z.boolean().default(true),
  allowTripSuggestions: z.boolean().default(true),
  allowFanMatching: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});

export type DiscoveryPreferences = z.infer<typeof DiscoveryPreferencesSchema>;

// ---------------------------------------------------------------------------
// Match Candidate (used internally by the matching engine)
// ---------------------------------------------------------------------------

export const MatchCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  candidateType: z.nativeEnum(MatchType),
  eventId: z.string().uuid(),
  score: z.number().min(0).max(1),
  scoreBreakdown: z.object({
    cityOverlap: z.number().min(0).max(1),
    dateOverlap: z.number().min(0).max(1),
    languageMatch: z.number().min(0).max(1),
    routeMatch: z.number().min(0).max(1),
    matchInterestAlignment: z.number().min(0).max(1),
    communityBonus: z.number().min(0).max(1),
    helperTrustBonus: z.number().min(0).max(1),
  }),
  sharedCities: z.array(z.string()),
  sharedDates: z.array(z.string().datetime()),
  commonLanguages: z.array(z.string()),
  isHelper: z.boolean().default(false),
  helperTrustTier: z.string().nullable().default(null),
  countryCommunityId: z.string().uuid().nullable(),
});

export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;

// ---------------------------------------------------------------------------
// Match Suggestion (sent to client)
// ---------------------------------------------------------------------------

export const MatchSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  matchType: z.nativeEnum(MatchType),
  viewerId: z.string().uuid(),
  targetId: z.string().uuid(),
  eventId: z.string().uuid(),
  score: z.number().min(0).max(1),
  sharedCities: z.array(z.string()),
  sharedLanguages: z.array(z.string()),
  sharedMatchIds: z.array(z.string().uuid()),
  helperOfferingSummary: z.string().nullable(),
  helperTrustTier: z.string().nullable(),
  communityTripId: z.string().uuid().nullable(),
  status: z.nativeEnum(MatchStatus).default(MatchStatus.PENDING),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type MatchSuggestion = z.infer<typeof MatchSuggestionSchema>;

// ---------------------------------------------------------------------------
// Match Request / Response (API contract)
// ---------------------------------------------------------------------------

export const MatchQueryParamsSchema = z.object({
  eventId: z.string().uuid(),
  matchType: z.nativeEnum(MatchType).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cityId: z.string().optional(),
  languageCode: z.string().length(2).optional(),
});

export type MatchQueryParams = z.infer<typeof MatchQueryParamsSchema>;

export const MatchSuggestionResponseSchema = z.object({
  suggestions: z.array(MatchSuggestionSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export type MatchSuggestionResponse = z.infer<typeof MatchSuggestionResponseSchema>;

// ---------------------------------------------------------------------------
// Block / Safety integration contract
// ---------------------------------------------------------------------------

/**
 * Contract consumed from safety-trust-system.
 * The matching engine calls this interface to exclude blocked/reported users.
 */
export interface BlockedUsersContract {
  /** Returns all user IDs that the viewer has blocked or that have blocked the viewer. */
  getMutualBlockList(viewerUserId: string): Promise<Set<string>>;
  /** Returns user IDs that have been platform-flagged/reported and should be excluded. */
  getPlatformFlaggedUsers(eventId: string): Promise<Set<string>>;
}

// ---------------------------------------------------------------------------
// User profile slice consumed by the matching engine
// ---------------------------------------------------------------------------

export interface FanMatchProfile {
  userId: string;
  eventId: string;
  citiesAttending: string[];          // city slugs
  travelDates: Array<{ cityId: string; arrivalDate: string; departureDate: string }>;
  matchesAttending: string[];         // match UUIDs
  languagesSpoken: string[];          // ISO 639-1
  countryCommunityId: string | null;
  isHelper: boolean;
  helperTrustTier: string | null;
  helperOfferingCategories: string[];
  helperLanguages: string[];
  discoverability: VisibilityLevel;
  tripIds: string[];                  // community trip IDs user is part of
  nationality: string | null;         // ISO 3166-1 alpha-2
  preferredLocale: string;            // BCP-47
}