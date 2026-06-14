/**
 * RoarPass — Verification Tiers & Trust Signals
 * Shared TypeScript contracts for verification system
 * Chunk: verification-trust-tiers | PRD refs: 7.2.4, 7.10.1, 5.3
 */

// ─── Enumerations ────────────────────────────────────────────────────────────

export enum VerificationTier {
  BASIC = 'BASIC',
  VERIFIED_IDENTITY = 'VERIFIED_IDENTITY',
  LOCAL_HELPER = 'LOCAL_HELPER',
  BUSINESS = 'BUSINESS',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
  VAT_CERTIFICATE = 'VAT_CERTIFICATE',
  HELPER_ATTESTATION = 'HELPER_ATTESTATION',
}

export enum ReputationEventType {
  POSITIVE_REVIEW = 'POSITIVE_REVIEW',
  NEGATIVE_REVIEW = 'NEGATIVE_REVIEW',
  VERIFIED_MEETUP_COMPLETED = 'VERIFIED_MEETUP_COMPLETED',
  HELPER_SERVICE_COMPLETED = 'HELPER_SERVICE_COMPLETED',
  MODERATION_VIOLATION = 'MODERATION_VIOLATION',
  APPEAL_UPHELD = 'APPEAL_UPHELD',
  REPORT_DISMISSED = 'REPORT_DISMISSED',
  TIER_UPGRADE = 'TIER_UPGRADE',
  ACCOUNT_FLAGGED = 'ACCOUNT_FLAGGED',
}

export enum TrustSignalType {
  VERIFIED_ID = 'VERIFIED_ID',
  LOCAL_HELPER = 'LOCAL_HELPER',
  BUSINESS_PARTNER = 'BUSINESS_PARTNER',
  COMMUNITY_VETERAN = 'COMMUNITY_VETERAN',
  EVENT_REGULAR = 'EVENT_REGULAR',
  TRUSTED_REVIEWER = 'TRUSTED_REVIEWER',
}

// ─── Core Data Entities ──────────────────────────────────────────────────────

export interface VerificationRecord {
  verification_id: string; // UUID
  user_id: string; // UUID → Fan Profile
  tier: VerificationTier;
  status: VerificationStatus;
  submitted_at: string; // ISO 8601
  reviewed_at: string | null; // ISO 8601
  reviewed_by: string | null; // UUID → Admin user
  approved_at: string | null; // ISO 8601
  expires_at: string | null; // ISO 8601; null = no expiry
  revocation_reason: string | null;
  rejection_reason: string | null;
  document_references: DocumentReference[]; // Refs only — no raw doc data
  metadata: VerificationMetadata;
}

export interface DocumentReference {
  reference_id: string; // UUID — points to secure doc storage
  document_type: DocumentType;
  uploaded_at: string; // ISO 8601
  /** Masked display: e.g. "Passport •••• 4523" */
  masked_display: string;
  verified: boolean;
}

export interface VerificationMetadata {
  /** ISO 3166-1 alpha-2 country of issuing authority */
  issuing_country: string | null;
  /** For business tier: registered entity name */
  entity_name: string | null;
  /** For local helper tier: city/region scope */
  helper_scope: string | null;
  /** Internal notes by reviewer — NOT exposed to users */
  reviewer_notes?: string;
}

export interface TrustProfile {
  user_id: string; // UUID
  current_tier: VerificationTier;
  verification_status: VerificationStatus;
  trust_signals: TrustSignal[];
  reputation_score: ReputationScore;
  badges: VerificationBadge[];
  created_at: string;
  updated_at: string;
}

export interface TrustSignal {
  signal_type: TrustSignalType;
  label: string; // i18n key resolved client-side
  awarded_at: string; // ISO 8601
  event_id: string | null; // UUID — if event-specific
  is_active: boolean;
}

export interface VerificationBadge {
  badge_id: string;
  tier: VerificationTier;
  /** i18n key for display label */
  label_key: string;
  /** Icon identifier for design system */
  icon: string;
  awarded_at: string;
  /** null = permanent; otherwise expiry date */
  expires_at: string | null;
  is_visible: boolean; // user can choose to hide
}

export interface ReputationScore {
  user_id: string;
  /** Composite score 0–1000 */
  global_score: number;
  /** Per-event scores keyed by event_id */
  event_scores: Record<string, EventReputationScore>;
  total_interactions: number;
  positive_interactions: number;
  negative_interactions: number;
  last_calculated_at: string;
}

export interface EventReputationScore {
  event_id: string;
  score: number; // 0–1000
  interactions: number;
  calculated_at: string;
}

export interface ReputationEvent {
  reputation_event_id: string;
  user_id: string;
  event_type: ReputationEventType;
  /** Positive/negative delta applied to score */
  score_delta: number;
  /** Source: review_id, meetup_id, etc. */
  source_reference_id: string | null;
  event_id: string | null;
  recorded_at: string;
  /** Reviewer-visible note */
  note: string | null;
}

// ─── API Request / Response Types ────────────────────────────────────────────

export interface SubmitVerificationRequest {
  tier: VerificationTier.VERIFIED_IDENTITY | VerificationTier.LOCAL_HELPER | VerificationTier.BUSINESS;
  document_references: Array<{
    reference_id: string;
    document_type: DocumentType;
    masked_display: string;
  }>;
  metadata: {
    issuing_country?: string;
    entity_name?: string;
    helper_scope?: string;
  };
}

export interface VerificationStatusResponse {
  verification_id: string;
  tier: VerificationTier;
  status: VerificationStatus;
  submitted_at: string;
  estimated_review_duration_hours: number | null;
  rejection_reason: string | null;
  current_tier: VerificationTier;
}

export interface TrustProfilePublicView {
  user_id: string;
  display_name: string; // from Fan Profile
  current_tier: VerificationTier;
  verification_status: VerificationStatus;
  /** Only badges user has opted to show */
  visible_badges: VerificationBadge[];
  trust_signals: TrustSignal[];
  /** Rounded to protect privacy: e.g. "850+" */
  reputation_score_display: string;
  /** Stats user has agreed to display */
  public_stats: {
    events_attended: number;
    helpers_served?: number; // only for LOCAL_HELPER / BUSINESS
    years_on_platform: number;
  };
}

export interface AdminVerificationReviewRequest {
  status: VerificationStatus.APPROVED | VerificationStatus.REJECTED | VerificationStatus.REVOKED;
  reviewer_notes: string;
  rejection_reason?: string;
  revocation_reason?: string;
}

export interface ReputationEventRequest {
  user_id: string;
  event_type: ReputationEventType;
  score_delta: number;
  source_reference_id?: string;
  event_id?: string;
  note?: string;
}

export interface VerificationListParams {
  status?: VerificationStatus;
  tier?: VerificationTier;
  page?: number;
  limit?: number;
}

export interface PaginatedVerifications {
  items: VerificationRecord[];
  total: number;
  page: number;
  limit: number;
}

// ─── UI Component Props ──────────────────────────────────────────────────────

export interface TrustBadgeProps {
  tier: VerificationTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export interface TrustProfileCardProps {
  profile: TrustProfilePublicView;
  compact?: boolean;
  className?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const TIER_ORDER: Record<VerificationTier, number> = {
  [VerificationTier.BASIC]: 0,
  [VerificationTier.VERIFIED_IDENTITY]: 1,
  [VerificationTier.LOCAL_HELPER]: 2,
  [VerificationTier.BUSINESS]: 3,
};

export const TIER_SCORE_THRESHOLDS: Record<VerificationTier, number> = {
  [VerificationTier.BASIC]: 0,
  [VerificationTier.VERIFIED_IDENTITY]: 100,
  [VerificationTier.LOCAL_HELPER]: 300,
  [VerificationTier.BUSINESS]: 0, // Business tier is not score-gated; document-gated
};

export const REPUTATION_SCORE_DELTAS: Record<ReputationEventType, number> = {
  [ReputationEventType.POSITIVE_REVIEW]: 25,
  [ReputationEventType.NEGATIVE_REVIEW]: -20,
  [ReputationEventType.VERIFIED_MEETUP_COMPLETED]: 15,
  [ReputationEventType.HELPER_SERVICE_COMPLETED]: 30,
  [ReputationEventType.MODERATION_VIOLATION]: -50,
  [ReputationEventType.APPEAL_UPHELD]: 30,
  [ReputationEventType.REPORT_DISMISSED]: 10,
  [ReputationEventType.TIER_UPGRADE]: 50,
  [ReputationEventType.ACCOUNT_FLAGGED]: -100,
};