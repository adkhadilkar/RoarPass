/**
 * RoarPass — Verification Tiers & Trust Signals
 * Database repository — Prisma-based persistence layer
 */

import { PrismaClient } from '@prisma/client';
import {
  VerificationRecord,
  TrustProfile,
  ReputationScore,
  ReputationEvent,
  VerificationStatus,
  VerificationTier,
  VerificationListParams,
  PaginatedVerifications,
  REPUTATION_SCORE_DELTAS,
} from '@roarpass/shared';
import { logger } from '../lib/logger';

export class VerificationRepository {
  constructor(private readonly db: PrismaClient) {}

  // ─── Verification Records ────────────────────────────────────────────────

  async findVerificationById(id: string): Promise<VerificationRecord | null> {
    const record = await this.db.verificationRecord.findUnique({
      where: { verification_id: id },
      include: { document_references: true },
    });
    if (!record) return null;
    return this.mapVerificationRecord(record);
  }

  async findActiveVerificationByUser(userId: string): Promise<VerificationRecord | null> {
    const record = await this.db.verificationRecord.findFirst({
      where: {
        user_id: userId,
        status: { in: [VerificationStatus.APPROVED, VerificationStatus.IN_REVIEW, VerificationStatus.PENDING] },
      },
      orderBy: { submitted_at: 'desc' },
      include: { document_references: true },
    });
    if (!record) return null;
    return this.mapVerificationRecord(record);
  }

  async findVerificationsByUser(userId: string): Promise<VerificationRecord[]> {
    const records = await this.db.verificationRecord.findMany({
      where: { user_id: userId },
      orderBy: { submitted_at: 'desc' },
      include: { document_references: true },
    });
    return records.map(this.mapVerificationRecord);
  }

  async listVerifications(params: VerificationListParams): Promise<PaginatedVerifications> {
    const { status, tier, page = 1, limit = 20 } = params;
    const where = {
      ...(status ? { status } : {}),
      ...(tier ? { tier } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.verificationRecord.findMany({
        where,
        orderBy: { submitted_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { document_references: true },
      }),
      this.db.verificationRecord.count({ where }),
    ]);

    return {
      items: items.map(this.mapVerificationRecord),
      total,
      page,
      limit,
    };
  }

  async createVerification(
    data: Omit<VerificationRecord, 'document_references'> & {
      document_references: Array<{
        reference_id: string;
        document_type: string;
        masked_display: string;
        uploaded_at: string;
        verified: boolean;
      }>;
    }
  ): Promise<VerificationRecord> {
    const record = await this.db.verificationRecord.create({
      data: {
        verification_id: data.verification_id,
        user_id: data.user_id,
        tier: data.tier,
        status: data.status,
        submitted_at: new Date(data.submitted_at),
        reviewed_at: data.reviewed_at ? new Date(data.reviewed_at) : null,
        reviewed_by: data.reviewed_by,
        approved_at: data.approved_at ? new Date(data.approved_at) : null,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
        revocation_reason: data.revocation_reason,
        rejection_reason: data.rejection_reason,
        metadata: data.metadata as object,
        document_references: {
          create: data.document_references.map((ref) => ({
            reference_id: ref.reference_id,
            document_type: ref.document_type,
            masked_display: ref.masked_display,
            uploaded_at: new Date(ref.uploaded_at),
            verified: ref.verified,
          })),
        },
      },
      include: { document_references: true },
    });
    return this.mapVerificationRecord(record);
  }

  async updateVerificationStatus(
    verificationId: string,
    update: {
      status: VerificationStatus;
      reviewed_by: string;
      reviewer_notes: string;
      rejection_reason?: string;
      revocation_reason?: string;
    }
  ): Promise<VerificationRecord> {
    const now = new Date();
    const record = await this.db.verificationRecord.update({
      where: { verification_id: verificationId },
      data: {
        status: update.status,
        reviewed_at: now,
        reviewed_by: update.reviewed_by,
        approved_at: update.status === VerificationStatus.APPROVED ? now : undefined,
        rejection_reason: update.rejection_reason ?? null,
        revocation_reason: update.revocation_reason ?? null,
        // reviewer_notes stored in metadata to avoid separate column
        metadata: {
          update: {
            reviewer_notes: update.reviewer_notes,
          },
        },
      },
      include: { document_references: true },
    });
    return this.mapVerificationRecord(record);
  }

  // ─── Trust Profile ────────────────────────────────────────────────────────

  async findTrustProfile(userId: string): Promise<TrustProfile | null> {
    return this.db.trustProfile.findUnique({ where: { user_id: userId } });
  }

  async upsertTrustProfile(profile: TrustProfile): Promise<TrustProfile> {
    return this.db.trustProfile.upsert({
      where: { user_id: profile.user_id },
      create: profile,
      update: {
        current_tier: profile.current_tier,
        verification_status: profile.verification_status,
        trust_signals: profile.trust_signals as object[],
        badges: profile.badges as object[],
        updated_at: new Date().toISOString(),
      },
    });
  }

  async updateTrustProfileTier(
    userId: string,
    tier: VerificationTier,
    status: VerificationStatus
  ): Promise<void> {
    await this.db.trustProfile.update({
      where: { user_id: userId },
      data: {
        current_tier: tier,
        verification_status: status,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async updateBadgeVisibility(
    userId: string,
    badgeIds: string[],
    isVisible: boolean
  ): Promise<void> {
    const profile = await this.findTrustProfile(userId);
    if (!profile) return;

    const updatedBadges = profile.badges.map((b) =>
      badgeIds.includes(b.badge_id) ? { ...b, is_visible: isVisible } : b
    );

    await this.db.trustProfile.update({
      where: { user_id: userId },
      data: { badges: updatedBadges as object[], updated_at: new Date().toISOString() },
    });
  }

  // ─── Reputation Score ─────────────────────────────────────────────────────

  async findReputationScore(userId: string): Promise<ReputationScore | null> {
    return this.db.reputationScore.findUnique({ where: { user_id: userId } });
  }

  async upsertReputationScore(score: ReputationScore): Promise<ReputationScore> {
    return this.db.reputationScore.upsert({
      where: { user_id: score.user_id },
      create: score,
      update: {
        global_score: score.global_score,
        event_scores: score.event_scores as object,
        total_interactions: score.total_interactions,
        positive_interactions: score.positive_interactions,
        negative_interactions: score.negative_interactions,
        last_calculated_at: score.last_calculated_at,
      },
    });
  }

  async applyScoreDelta(
    userId: string,
    delta: number,
    eventId?: string
  ): Promise<ReputationScore> {
    const existing = await this.findReputationScore(userId);
    const now = new Date().toISOString();

    if (!existing) {
      const initial: ReputationScore = {
        user_id: userId,
        global_score: Math.max(0, Math.min(1000, delta)),
        event_scores: {},
        total_interactions: 1,
        positive_interactions: delta > 0 ? 1 : 0,
        negative_interactions: delta < 0 ? 1 : 0,
        last_calculated_at: now,
      };
      return this.upsertReputationScore(initial);
    }

    const newGlobal = Math.max(0, Math.min(1000, existing.global_score + delta));
    const eventScores = { ...existing.event_scores } as Record<string, { event_id: string; score: number; interactions: number; calculated_at: string }>;

    if (eventId) {
      const ev = eventScores[eventId] ?? { event_id: eventId, score: 0, interactions: 0, calculated_at: now };
      eventScores[eventId] = {
        ...ev,
        score: Math.max(0, Math.min(1000, ev.score + delta)),
        interactions: ev.interactions + 1,
        calculated_at: now,
      };
    }

    const updated: ReputationScore = {
      ...existing,
      global_score: newGlobal,
      event_scores: eventScores,
      total_interactions: existing.total_interactions + 1,
      positive_interactions: delta > 0 ? existing.positive_interactions + 1 : existing.positive_interactions,
      negative_interactions: delta < 0 ? existing.negative_interactions + 1 : existing.negative_interactions,
      last_calculated_at: now,
    };

    return this.upsertReputationScore(updated);
  }

  // ─── Reputation Events ────────────────────────────────────────────────────

  async createReputationEvent(event: ReputationEvent): Promise<ReputationEvent> {
    return this.db.reputationEvent.create({ data: event });
  }

  async findReputationEvents(
    userId: string,
    limit = 50
  ): Promise<ReputationEvent[]> {
    return this.db.reputationEvent.findMany({
      where: { user_id: userId },
      orderBy: { recorded_at: 'desc' },
      take: limit,
    });
  }

  // ─── Private Mapper ────────────────────────────────────────────────────────

  private mapVerificationRecord(raw: any): VerificationRecord {
    return {
      ...raw,
      submitted_at: raw.submitted_at instanceof Date ? raw.submitted_at.toISOString() : raw.submitted_at,
      reviewed_at: raw.reviewed_at instanceof Date ? raw.reviewed_at.toISOString() : raw.reviewed_at,
      approved_at: raw.approved_at instanceof Date ? raw.approved_at.toISOString() : raw.approved_at,
      expires_at: raw.expires_at instanceof Date ? raw.expires_at.toISOString() : raw.expires_at,
      document_references: (raw.document_references ?? []).map((d: any) => ({
        ...d,
        uploaded_at: d.uploaded_at instanceof Date ? d.uploaded_at.toISOString() : d.uploaded_at,
      })),
    };
  }
}