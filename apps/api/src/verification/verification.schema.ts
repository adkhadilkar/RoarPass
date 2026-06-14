/**
 * RoarPass — Verification Tiers & Trust Signals
 * Zod validation schemas for API inputs
 */

import { z } from 'zod';
import {
  VerificationTier,
  DocumentType,
  VerificationStatus,
  ReputationEventType,
} from '@roarpass/shared';

// ─── Document Reference Schema ────────────────────────────────────────────────

export const DocumentReferenceSchema = z.object({
  reference_id: z.string().uuid(),
  document_type: z.nativeEnum(DocumentType),
  masked_display: z.string().max(100),
});

// ─── Submit Verification Schema ───────────────────────────────────────────────

export const SubmitVerificationSchema = z.object({
  tier: z.enum([
    VerificationTier.VERIFIED_IDENTITY,
    VerificationTier.LOCAL_HELPER,
    VerificationTier.BUSINESS,
  ]),
  document_references: z
    .array(DocumentReferenceSchema)
    .min(1, 'At least one document reference is required')
    .max(5, 'Maximum 5 document references allowed'),
  metadata: z
    .object({
      issuing_country: z
        .string()
        .length(2)
        .regex(/^[A-Z]{2}$/, 'Must be ISO 3166-1 alpha-2')
        .optional(),
      entity_name: z.string().max(200).optional(),
      helper_scope: z.string().max(200).optional(),
    })
    .optional()
    .default({}),
});

// ─── Admin Review Schema ──────────────────────────────────────────────────────

export const AdminReviewSchema = z.object({
  status: z.enum([
    VerificationStatus.APPROVED,
    VerificationStatus.REJECTED,
    VerificationStatus.REVOKED,
  ]),
  reviewer_notes: z.string().min(1).max(1000),
  rejection_reason: z.string().max(500).optional(),
  revocation_reason: z.string().max(500).optional(),
});

// ─── Reputation Event Schema ──────────────────────────────────────────────────

export const ReputationEventSchema = z.object({
  user_id: z.string().uuid(),
  event_type: z.nativeEnum(ReputationEventType),
  score_delta: z.number().int().min(-500).max(500),
  source_reference_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

// ─── List Query Schema ────────────────────────────────────────────────────────

export const VerificationListQuerySchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
  tier: z.nativeEnum(VerificationTier).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Badge Visibility Schema ──────────────────────────────────────────────────

export const UpdateBadgeVisibilitySchema = z.object({
  badge_ids: z.array(z.string().uuid()).min(1).max(20),
  is_visible: z.boolean(),
});

export type SubmitVerificationInput = z.infer<typeof SubmitVerificationSchema>;
export type AdminReviewInput = z.infer<typeof AdminReviewSchema>;
export type ReputationEventInput = z.infer<typeof ReputationEventSchema>;
export type VerificationListQuery = z.infer<typeof VerificationListQuerySchema>;
export type UpdateBadgeVisibilityInput = z.infer<typeof UpdateBadgeVisibilitySchema>;