import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  MatchType,
  VisibilityLevel,
  MatchStatus,
  MatchCandidate,
  MatchSuggestion,
  MatchQueryParams,
  FanMatchProfile,
  BlockedUsersContract,
} from '@roarpass/shared';
import { DiscoveryPreferenceEntity } from './entities/discovery-preference.entity';
import { MatchSuggestionEntity } from './entities/match-suggestion.entity';
import { FanMatchProfileEntity } from './entities/fan-match-profile.entity';
import { SafetyTrustService } from '../safety/safety-trust.service';

// ---------------------------------------------------------------------------
// Scoring weights (sum must equal 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS = {
  cityOverlap: 0.30,
  dateOverlap: 0.20,
  languageMatch: 0.20,
  routeMatch: 0.10,
  matchInterestAlignment: 0.10,
  communityBonus: 0.05,
  helperTrustBonus: 0.05,
} as const;

const SCORE_THRESHOLD = 0.15;        // minimum score to surface a suggestion
const MAX_CANDIDATES_PER_EVENT = 500; // performance guard — prevents unbounded scans
const SUGGESTION_TTL_HOURS = 48;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(DiscoveryPreferenceEntity)
    private readonly prefRepo: Repository<DiscoveryPreferenceEntity>,
    @InjectRepository(MatchSuggestionEntity)
    private readonly suggRepo: Repository<MatchSuggestionEntity>,
    @InjectRepository(FanMatchProfileEntity)
    private readonly profileRepo: Repository<FanMatchProfileEntity>,
    private readonly safetyTrust: SafetyTrustService,
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async getSuggestions(
    viewerUserId: string,
    params: MatchQueryParams,
  ): Promise<{ suggestions: MatchSuggestion[]; total: number }> {
    const { eventId, matchType, limit, offset, cityId, languageCode } = params;

    // 1. Load viewer profile & preferences
    const viewerProfile = await this.getViewerProfile(viewerUserId, eventId);
    const viewerPrefs = await this.getDiscoveryPreferences(viewerUserId);

    // 2. Load exclusion lists from safety-trust-system (HIGH PRIORITY — before any other work)
    const excludedIds = await this.safetyTrust.getExcludedUserIds(viewerUserId, eventId);

    // 3. Load candidate profiles (capped to MAX_CANDIDATES_PER_EVENT for perf)
    const candidates = await this.loadCandidates(
      viewerUserId,
      eventId,
      excludedIds,
      matchType,
      cityId,
      languageCode,
    );

    // 4. Score & rank
    const scored = candidates
      .map((c) => this.scoreCandidate(viewerProfile, c, viewerPrefs))
      .filter((c) => c.score >= SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score); // descending score; stable sort for tie-breaking

    // 5. Paginate
    const total = scored.length;
    const paginated = scored.slice(offset, offset + limit);

    // 6. Persist suggestions (upsert)
    const suggestions = await this.persistSuggestions(viewerUserId, paginated, eventId);

    return { suggestions, total };
  }

  async getDiscoveryPreferences(userId: string): Promise<DiscoveryPreferenceEntity> {
    let prefs = await this.prefRepo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.prefRepo.create({
        userId,
        visibilityLevel: VisibilityLevel.HIDDEN,
        shareCity: false,
        shareTravelDates: false,
        shareMatchInterests: false,
        shareLanguages: true,
        shareCountryCommunity: true,
        allowHelperSuggestions: true,
        allowTripSuggestions: true,
        allowFanMatching: false,
      });
      await this.prefRepo.save(prefs);
    }
    return prefs;
  }

  async updateDiscoveryPreferences(
    userId: string,
    updates: Partial<Omit<DiscoveryPreferenceEntity, 'userId' | 'updatedAt'>>,
  ): Promise<DiscoveryPreferenceEntity> {
    const prefs = await this.getDiscoveryPreferences(userId);
    Object.assign(prefs, updates);
    prefs.updatedAt = new Date();
    return this.prefRepo.save(prefs);
  }

  async respondToSuggestion(
    viewerUserId: string,
    suggestionId: string,
    status: MatchStatus.ACCEPTED | MatchStatus.DECLINED,
  ): Promise<MatchSuggestionEntity> {
    const suggestion = await this.suggRepo.findOne({
      where: { id: suggestionId, viewerId: viewerUserId },
    });
    if (!suggestion) {
      throw new Error('Suggestion not found or not owned by user');
    }
    suggestion.status = status;
    suggestion.respondedAt = new Date();
    return this.suggRepo.save(suggestion);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async getViewerProfile(userId: string, eventId: string): Promise<FanMatchProfileEntity> {
    const profile = await this.profileRepo.findOne({ where: { userId, eventId } });
    if (!profile) {
      throw new Error(`Fan match profile not found for user ${userId} event ${eventId}`);
    }
    return profile;
  }

  /**
   * Loads candidate profiles respecting:
   *  - discoverability level (opt-in)
   *  - exclusion list (blocked/reported/banned)
   *  - perf cap (MAX_CANDIDATES_PER_EVENT)
   *
   * TypeORM query uses index on (eventId, discoverability) to avoid full scans.
   */
  private async loadCandidates(
    viewerUserId: string,
    eventId: string,
    excludedIds: Set<string>,
    matchType?: MatchType,
    cityId?: string,
    languageCode?: string,
  ): Promise<FanMatchProfileEntity[]> {
    const qb = this.profileRepo
      .createQueryBuilder('p')
      .where('p.eventId = :eventId', { eventId })
      .andWhere('p.userId != :viewerUserId', { viewerUserId })
      .andWhere('p.discoverability != :hidden', { hidden: VisibilityLevel.HIDDEN })
      .take(MAX_CANDIDATES_PER_EVENT);

    // Filter out blocked/flagged users via NOT IN — excludedIds expected to be small (<1000)
    if (excludedIds.size > 0) {
      qb.andWhere('p.userId NOT IN (:...excludedIds)', {
        excludedIds: Array.from(excludedIds),
      });
    }

    if (matchType === MatchType.FAN_TO_HELPER) {
      qb.andWhere('p.isHelper = true');
    } else if (matchType === MatchType.FAN_TO_FAN) {
      qb.andWhere('p.isHelper = false');
    }

    if (cityId) {
      // cities are stored as JSON array; use JSON_CONTAINS for MySQL or @> for PG
      qb.andWhere(':cityId = ANY(p.citiesAttending)', { cityId });
    }

    if (languageCode) {
      qb.andWhere(':languageCode = ANY(p.languagesSpoken)', { languageCode });
    }

    return qb.getMany();
  }

  /**
   * Scores a candidate against the viewer profile.
   *
   * All dimension scores are in [0, 1].
   * Final score is a weighted sum capped at 1.0.
   */
  scoreCandidate(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
    viewerPrefs: DiscoveryPreferenceEntity,
  ): MatchCandidate {
    const cityOverlap = this.computeCityOverlap(viewer, candidate);
    const dateOverlap = this.computeDateOverlap(viewer, candidate);
    const languageMatch = this.computeLanguageMatch(viewer, candidate);
    const routeMatch = this.computeRouteMatch(viewer, candidate);
    const matchInterestAlignment = this.computeMatchInterestAlignment(viewer, candidate);
    const communityBonus = this.computeCommunityBonus(viewer, candidate);
    const helperTrustBonus = this.computeHelperTrustBonus(candidate);

    const score = Math.min(
      1.0,
      cityOverlap * WEIGHTS.cityOverlap +
        dateOverlap * WEIGHTS.dateOverlap +
        languageMatch * WEIGHTS.languageMatch +
        routeMatch * WEIGHTS.routeMatch +
        matchInterestAlignment * WEIGHTS.matchInterestAlignment +
        communityBonus * WEIGHTS.communityBonus +
        helperTrustBonus * WEIGHTS.helperTrustBonus,
    );

    const sharedCities = (viewer.citiesAttending ?? []).filter((c) =>
      (candidate.citiesAttending ?? []).includes(c),
    );

    const commonLanguages = (viewer.languagesSpoken ?? []).filter((l) =>
      (candidate.languagesSpoken ?? []).includes(l),
    );

    const matchType = candidate.isHelper ? MatchType.FAN_TO_HELPER : MatchType.FAN_TO_FAN;

    return {
      candidateId: candidate.userId,
      candidateType: matchType,
      eventId: candidate.eventId,
      score,
      scoreBreakdown: {
        cityOverlap,
        dateOverlap,
        languageMatch,
        routeMatch,
        matchInterestAlignment,
        communityBonus,
        helperTrustBonus,
      },
      sharedCities,
      sharedDates: this.getOverlappingDates(viewer, candidate),
      commonLanguages,
      isHelper: candidate.isHelper,
      helperTrustTier: candidate.helperTrustTier ?? null,
      countryCommunityId: candidate.countryCommunityId ?? null,
    };
  }

  // --- scoring dimensions -------------------------------------------------

  private computeCityOverlap(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    const vCities = new Set(viewer.citiesAttending ?? []);
    const cCities = new Set(candidate.citiesAttending ?? []);
    const intersection = new Set([...vCities].filter((c) => cCities.has(c)));
    const union = new Set([...vCities, ...cCities]);
    return union.size === 0 ? 0 : intersection.size / union.size; // Jaccard similarity
  }

  private computeDateOverlap(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    const overlappingDates = this.getOverlappingDates(viewer, candidate);
    // Normalize: 1 day overlap → 0.5, 4+ days → 1.0
    return Math.min(1.0, overlappingDates.length / 4);
  }

  private computeLanguageMatch(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    const vLangs = new Set(viewer.languagesSpoken ?? []);
    const cLangs = new Set(
      candidate.isHelper
        ? candidate.helperLanguages ?? []
        : candidate.languagesSpoken ?? [],
    );
    const hasMatch = [...vLangs].some((l) => cLangs.has(l));
    return hasMatch ? 1.0 : 0.0;
  }

  private computeRouteMatch(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    // A "route" is an ordered city pair derived from sorted travel dates.
    const viewerRoutes = this.extractRoutes(viewer);
    const candidateRoutes = this.extractRoutes(candidate);
    const vSet = new Set(viewerRoutes);
    const matches = candidateRoutes.filter((r) => vSet.has(r));
    return matches.length > 0 ? Math.min(1.0, matches.length / viewerRoutes.length) : 0;
  }

  private computeMatchInterestAlignment(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    const vMatches = new Set(viewer.matchesAttending ?? []);
    const cMatches = new Set(candidate.matchesAttending ?? []);
    const intersection = new Set([...vMatches].filter((m) => cMatches.has(m)));
    const union = new Set([...vMatches, ...cMatches]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private computeCommunityBonus(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): number {
    return viewer.countryCommunityId &&
      candidate.countryCommunityId &&
      viewer.countryCommunityId === candidate.countryCommunityId
      ? 1.0
      : 0.0;
  }

  private computeHelperTrustBonus(candidate: FanMatchProfileEntity): number {
    if (!candidate.isHelper || !candidate.helperTrustTier) return 0;
    const tierScores: Record<string, number> = {
      verified_local: 1.0,
      community_verified: 0.75,
      basic: 0.5,
    };
    return tierScores[candidate.helperTrustTier] ?? 0.25;
  }

  // --- utility methods -----------------------------------------------------

  private getOverlappingDates(
    viewer: FanMatchProfileEntity,
    candidate: FanMatchProfileEntity,
  ): string[] {
    const overlapping: string[] = [];
    for (const vPeriod of viewer.travelDates ?? []) {
      for (const cPeriod of candidate.travelDates ?? []) {
        if (vPeriod.cityId !== cPeriod.cityId) continue;
        const vStart = new Date(vPeriod.arrivalDate).getTime();
        const vEnd = new Date(vPeriod.departureDate).getTime();
        const cStart = new Date(cPeriod.arrivalDate).getTime();
        const cEnd = new Date(cPeriod.departureDate).getTime();
        const overlapStart = Math.max(vStart, cStart);
        const overlapEnd = Math.min(vEnd, cEnd);
        if (overlapEnd >= overlapStart) {
          // Generate daily dates in overlap window
          const dayMs = 86400000;
          for (let t = overlapStart; t <= overlapEnd; t += dayMs) {
            overlapping.push(new Date(t).toISOString().split('T')[0]);
          }
        }
      }
    }
    return [...new Set(overlapping)];
  }

  private extractRoutes(profile: FanMatchProfileEntity): string[] {
    const sorted = [...(profile.travelDates ?? [])].sort(
      (a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime(),
    );
    const routes: string[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].cityId !== sorted[i + 1].cityId) {
        routes.push(`${sorted[i].cityId}→${sorted[i + 1].cityId}`);
      }
    }
    return routes;
  }

  private async persistSuggestions(
    viewerUserId: string,
    candidates: MatchCandidate[],
    eventId: string,
  ): Promise<MatchSuggestion[]> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SUGGESTION_TTL_HOURS * 3600 * 1000);

    const suggestions: MatchSuggestion[] = [];

    const candidateIds = candidates.map(c => c.candidateId);
    let existingSuggestionsMap = new Map<string, MatchSuggestionEntity>();

    if (candidateIds.length > 0) {
      const existingEntities = await this.suggRepo.find({
        where: {
          viewerId: viewerUserId,
          eventId: eventId,
          status: MatchStatus.PENDING,
          targetId: In(candidateIds),
        },
      });
      for (const entity of existingEntities) {
        existingSuggestionsMap.set(entity.targetId, entity);
      }
    }

    for (const c of candidates) {
      // Upsert: if a suggestion for this pair already exists and is PENDING, reuse it
      let entity = existingSuggestionsMap.get(c.candidateId);

      if (!entity) {
        entity = this.suggRepo.create({
          id: uuidv4(),
          viewerId: viewerUserId,
          targetId: c.candidateId,
          eventId,
          matchType: c.candidateType,
          score: c.score,
          sharedCities: c.sharedCities,
          commonLanguages: c.commonLanguages,
          helperTrustTier: c.helperTrustTier,
          status: MatchStatus.PENDING,
          createdAt: now,
          expiresAt,
          respondedAt: null,
        });
      } else {
        entity.score = c.score;
        entity.expiresAt = expiresAt;
      }

      const saved = await this.suggRepo.save(entity);

      suggestions.push({
        suggestionId: saved.id,
        matchType: saved.matchType as MatchType,
        viewerId: saved.viewerId,
        targetId: saved.targetId,
        eventId: saved.eventId,
        score: saved.score,
        sharedCities: saved.sharedCities ?? [],
        sharedLanguages: saved.commonLanguages ?? [],
        sharedMatchIds: [],
        helperOfferingSummary: null,
        helperTrustTier: saved.helperTrustTier ?? null,
        communityTripId: null,
        status: saved.status as MatchStatus,
        createdAt: saved.createdAt.toISOString(),
        expiresAt: saved.expiresAt.toISOString(),
      });
    }

    return suggestions;
  }
}