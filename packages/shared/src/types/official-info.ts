/**
 * Shared TypeScript contracts for Official Information & Visa Intelligence
 * Chunk: official-info-layer | PRD refs: 7.8.1, 7.8.2, 7.8.4
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum InfoContentType {
  EVENT_GUIDE = 'EVENT_GUIDE',
  CITY_GUIDE = 'CITY_GUIDE',
  MATCH_SCHEDULE = 'MATCH_SCHEDULE',
  VISA_REQUIREMENT = 'VISA_REQUIREMENT',
  ENTRY_REQUIREMENT = 'ENTRY_REQUIREMENT',
  OFFICIAL_PORTAL_LINK = 'OFFICIAL_PORTAL_LINK',
}

export enum InfoSourceTrust {
  /** Directly fetched/linked from a government or official event portal */
  OFFICIAL = 'OFFICIAL',
  /** Sourced from a verified partner organization (e.g., FIFA, UEFA) */
  PARTNER = 'PARTNER',
  /** Community-contributed, reviewed by a moderator */
  COMMUNITY_VERIFIED = 'COMMUNITY_VERIFIED',
  /** Unreviewed community contribution */
  COMMUNITY_UNVERIFIED = 'COMMUNITY_UNVERIFIED',
}

export enum VisaRequirementType {
  NOT_REQUIRED = 'NOT_REQUIRED',
  VISA_ON_ARRIVAL = 'VISA_ON_ARRIVAL',
  E_VISA = 'E_VISA',
  VISA_REQUIRED = 'VISA_REQUIRED',
  ENTRY_DENIED = 'ENTRY_DENIED',
  CHECK_EMBASSY = 'CHECK_EMBASSY',
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED',
  POSTPONED = 'POSTPONED',
  CANCELLED = 'CANCELLED',
}

export enum GuideSection {
  TRANSPORTATION = 'TRANSPORTATION',
  ACCOMMODATION = 'ACCOMMODATION',
  FOOD_AND_DRINK = 'FOOD_AND_DRINK',
  SAFETY = 'SAFETY',
  CULTURE = 'CULTURE',
  CURRENCY = 'CURRENCY',
  EMERGENCY_CONTACTS = 'EMERGENCY_CONTACTS',
  STADIUM_INFO = 'STADIUM_INFO',
  TICKETING = 'TICKETING',
  LOCAL_LAWS = 'LOCAL_LAWS',
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface OfficialInfoSource {
  sourceId: string;
  name: string;
  url: string;
  trustLevel: InfoSourceTrust;
  lastVerifiedAt: string; // ISO 8601
  language: string; // ISO 639-1
}

export interface LocalizedContent {
  language: string; // ISO 639-1
  isRtl: boolean;
  title: string;
  body: string;
  /** UTC ISO 8601 – when this translation was last updated */
  translatedAt: string;
}

export interface EventGuide {
  guideId: string;
  eventId: string;
  hostCityId: string;
  contentType: InfoContentType.EVENT_GUIDE;
  section: GuideSection;
  /** Canonical content in the platform's primary editorial language (en) */
  sourceText: string;
  localizations: LocalizedContent[];
  trustLevel: InfoSourceTrust;
  sources: OfficialInfoSource[];
  /** Markdown supported */
  richContent?: string;
  lastUpdatedAt: string; // ISO 8601
  lastVerifiedAt: string; // ISO 8601
  isActive: boolean;
  /** Flag for data-provenance display in UI */
  dataProvenanceBadge: string; // e.g. "Official – FIFA.com"
}

export interface CityGuide {
  guideId: string;
  cityId: string;
  /** Country ISO 3166-1 alpha-2 */
  countryCode: string;
  contentType: InfoContentType.CITY_GUIDE;
  section: GuideSection;
  sourceText: string;
  localizations: LocalizedContent[];
  trustLevel: InfoSourceTrust;
  sources: OfficialInfoSource[];
  richContent?: string;
  lastUpdatedAt: string;
  lastVerifiedAt: string;
  isActive: boolean;
  dataProvenanceBadge: string;
}

export interface MatchInfo {
  matchId: string;
  eventId: string;
  matchNumber: number;
  stage: string; // e.g. "Group Stage", "Quarter Final"
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  venue: VenueInfo;
  /** UTC kick-off time */
  kickoffUtc: string; // ISO 8601
  /** Host city local kick-off time */
  kickoffLocal: string; // ISO 8601 with offset
  hostCityTimezone: string; // IANA tz, e.g. "America/Chicago"
  status: MatchStatus;
  score?: MatchScore;
  broadcastInfo?: BroadcastInfo[];
  lastUpdatedAt: string;
}

export interface TeamInfo {
  teamId: string;
  name: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  flagUrl?: string;
}

export interface VenueInfo {
  venueId: string;
  name: string;
  cityId: string;
  cityName: string;
  countryCode: string;
  capacity: number;
  addressLine1: string;
  addressLine2?: string;
  latitude: number;
  longitude: number;
  accessibilityInfo?: string;
  /** Gate opening time relative to kick-off in minutes */
  gatesOpenMinutesBefore: number;
}

export interface MatchScore {
  home: number;
  away: number;
  homeExtraTime?: number;
  awayExtraTime?: number;
  homePenalty?: number;
  awayPenalty?: number;
}

export interface BroadcastInfo {
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  broadcaster: string;
  channelName: string;
}

export interface VisaRequirement {
  requirementId: string;
  /** Traveler nationality ISO 3166-1 alpha-2 */
  nationalityCode: string;
  /** Destination country ISO 3166-1 alpha-2 */
  destinationCountryCode: string;
  requirementType: VisaRequirementType;
  /** Official government visa portal URL */
  officialPortalUrl: string;
  /** Official embassy/consulate URL for this pair */
  embassyUrl?: string;
  /** Duration of stay permitted without visa (days), null if visa required */
  visaFreeDays?: number;
  conditions: string[];
  /** e.g. "Valid for FIFA World Cup 2026 period" */
  specialEventNotes?: string;
  sources: OfficialInfoSource[];
  trustLevel: InfoSourceTrust;
  /** Must show in UI that this is not legal advice */
  legalDisclaimer: string;
  lastVerifiedAt: string;
  /** Expiry date of this information – triggers admin alert when past */
  expiresAt?: string;
  localizations: LocalizedContent[];
  dataProvenanceBadge: string;
}

export interface OfficialPortalLink {
  linkId: string;
  /** 'event' | 'country' | 'city' scope */
  scope: 'event' | 'country' | 'city';
  scopeId: string; // eventId | countryCode | cityId
  label: string;
  url: string;
  /** ISO 3166-1 alpha-2 issuing authority country */
  authorityCountryCode: string;
  trustLevel: InfoSourceTrust;
  lastVerifiedAt: string;
  isActive: boolean;
  localizations: LocalizedContent[];
}

// ─── Request / Response Shapes ────────────────────────────────────────────────

export interface GetEventGuidesParams {
  eventId: string;
  hostCityId?: string;
  section?: GuideSection;
  language?: string;
}

export interface GetCityGuidesParams {
  cityId: string;
  section?: GuideSection;
  language?: string;
}

export interface GetMatchScheduleParams {
  eventId: string;
  /** ISO 8601 date string */
  fromDate?: string;
  toDate?: string;
  teamId?: string;
  hostCityId?: string;
  /** IANA timezone for local time conversion */
  viewerTimezone?: string;
}

export interface MatchScheduleResponse {
  eventId: string;
  matches: MatchInfo[];
  /** Viewer's IANA timezone used for conversion */
  viewerTimezone: string;
  lastUpdatedAt: string;
}

export interface GetVisaRequirementsParams {
  nationalityCode: string;
  destinationCountryCode: string;
  eventId?: string;
}

export interface VisaRequirementsResponse {
  requirements: VisaRequirement[];
  officialPortalLinks: OfficialPortalLink[];
  /** Always shown regardless of data state */
  globalLegalDisclaimer: string;
}

export interface GetOfficialPortalLinksParams {
  scope: 'event' | 'country' | 'city';
  scopeId: string;
  language?: string;
}

// ─── Admin Shapes ─────────────────────────────────────────────────────────────

export interface UpsertEventGuideBody {
  eventId: string;
  hostCityId: string;
  section: GuideSection;
  sourceText: string;
  richContent?: string;
  trustLevel: InfoSourceTrust;
  sources: Omit<OfficialInfoSource, 'sourceId'>[];
  localizations?: Omit<LocalizedContent, 'translatedAt'>[];
  dataProvenanceBadge: string;
}

export interface UpsertVisaRequirementBody {
  nationalityCode: string;
  destinationCountryCode: string;
  requirementType: VisaRequirementType;
  officialPortalUrl: string;
  embassyUrl?: string;
  visaFreeDays?: number;
  conditions: string[];
  specialEventNotes?: string;
  sources: Omit<OfficialInfoSource, 'sourceId'>[];
  legalDisclaimer: string;
  expiresAt?: string;
  localizations?: Omit<LocalizedContent, 'translatedAt'>[];
  dataProvenanceBadge: string;
  eventId?: string;
}

export interface UpsertOfficialPortalLinkBody {
  scope: 'event' | 'country' | 'city';
  scopeId: string;
  label: string;
  url: string;
  authorityCountryCode: string;
  trustLevel: InfoSourceTrust;
  localizations?: Omit<LocalizedContent, 'translatedAt'>[];
}

// ─── Cache Metadata ───────────────────────────────────────────────────────────

export interface CacheMetadata {
  cachedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  etag?: string;
}

export interface CachedResponse<T> {
  data: T;
  cache: CacheMetadata;
  /** Whether this response came from cache */
  fromCache: boolean;
}