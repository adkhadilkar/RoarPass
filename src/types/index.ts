// Shared domain contracts for RoarPass
// Merged: main (Event, CountryCommunity, FanProfile) + safety-trust-system additions

export type ID = string;

export interface Event {
  id: ID;
  title: string;
  startsAt: string; // ISO-8601
  endsAt: string;   // ISO-8601
  countryCode: string; // ISO-3166-1 alpha-2
  venue?: string;
}

export interface CountryCommunity {
  id: ID;
  countryCode: string; // ISO-3166-1 alpha-2
  name: string;
  memberCount: number;
}

export interface FanProfile {
  id: ID;
  displayName: string;
  homeCountryCode: string;
  locale: string;
  // safety-trust-system additions
  trustLevel: TrustLevel;
  isVerified: boolean;
}

export interface LocalHelper {
  id: ID;
  fanProfileId: ID;
  countryCode: string;
  languages: string[];
  // safety-trust-system additions
  trustLevel: TrustLevel;
  backgroundCheckStatus: BackgroundCheckStatus;
}

export interface CommunityTrip {
  id: ID;
  eventId: ID;
  countryCommunityId: ID;
  organizerFanProfileId: ID;
  participantFanProfileIds: ID[];
}

/* ===== safety-trust-system contracts ===== */

export enum TrustLevel {
  New = 'new',
  Established = 'established',
  Trusted = 'trusted',
  Ambassador = 'ambassador',
}

export enum BackgroundCheckStatus {
  NotStarted = 'not_started',
  Pending = 'pending',
  Cleared = 'cleared',
  Failed = 'failed',
}

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'unsafe_behavior'
  | 'other';

export interface SafetyReport {
  id: ID;
  reporterFanProfileId: ID;
  reportedFanProfileId: ID;
  contextType: 'event' | 'trip' | 'community' | 'message';
  contextId: ID;
  reason: ReportReason;
  details?: string;
  createdAt: string; // ISO-8601
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
}

export interface BlockRecord {
  id: ID;
  blockerFanProfileId: ID;
  blockedFanProfileId: ID;
  createdAt: string; // ISO-8601
}