import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  MatchingProfile,
  FanMatch,
  DiscoveryCard,
  MatchRequest,
  CoTravelerSignal,
  UpsertMatchingProfileRequest,
  DiscoveryQuery,
  DiscoveryResult,
  SendMatchRequest,
  MatchingSignal,
  MatchingSignalType,
} from '@roarpass/shared/types/matching-engine';
import { MatchingProfileEntity } from './entities/matching-profile.entity';
import { FanMatchEntity } from './entities/fan-match.entity';
import { MatchRequestEntity } from './entities/match-request.entity';
import { MatchingCacheService } from './matching-cache.service';
import { MatchingEngineConfig } from './matching-engine.config';

// Score weights per signal type
const SIGNAL_WEIGHTS: Record<MatchingSignalType, number> = {
  SAME_MATCH: 0.35,
  SAME_CITY: 0.20,
  SAME_ROUTE: 0.20,
  SAME_DATES: 0.10,
  SHARED_LANGUAGE: 0.05,
  SAME_COUNTRY_COMMUNITY: 0.05,
  HELPER_MATCH: 0.05,
};

@Injectable()
export class MatchingEngineService {
  constructor(
    @InjectRepository(MatchingProfileEntity)
    private readonly profileRepo: Repository<MatchingProfileEntity>,
    @InjectRepository(FanMatchEntity)
    private readonly matchRepo: Repository<FanMatchEntity>,
    @InjectRepository(MatchRequestEntity)
    private readonly requestRepo: Repository<MatchRequestEntity>,
    private readonly cache: MatchingCacheService,
    private readonly config: MatchingEngineConfig,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Profile Management ─────────────────────────────────────────────────────

  async upsertProfile(
    userId: string,
    dto: UpsertMatchingProfileRequest,
  ): Promise<MatchingProfile> {
    // Validate date ordering
    if (
      new Date(dto.travelDates.arrivalDate) >=
      new Date(dto.travelDates.departureDate)
    ) {
      throw new BadRequestException(
        'arrivalDate must be before departureDate',
      );
    }

    let entity = await this.profileRepo.findOne({
      where: { userId, eventId: dto.eventId },
    });

    if (entity) {
      entity.visibility = dto.visibility;
      entity.citiesAttending = dto.citiesAttending;
      entity.matchIds = dto.matchIds;
      entity.travelDates = dto.travelDates;
      entity.routeCityPairs = dto.routeCityPairs;
      entity.updatedAt = new Date();
    } else {
      entity = this.profileRepo.create({
        userId,
        eventId: dto.eventId,
        visibility: dto.visibility,
        citiesAttending: dto.citiesAttending,
        matchIds: dto.matchIds,
        travelDates: dto.travelDates,
        routeCityPairs: dto.routeCityPairs,
        languagesSpoken: [],  // populated from Fan Profile join
        countryCommunityId: null,
        isHelper: false,
      });
    }

    const saved = await this.profileRepo.save(entity);

    // Invalidate discovery cache for this event
    await this.cache.invalidateDiscovery(dto.eventId);

    return this.toMatchingProfileDto(saved);
  }

  async getProfile(
    userId: string,
    eventId: string,
  ): Promise<MatchingProfile | null> {
    const entity = await this.profileRepo.findOne({
      where: { userId, eventId },
    });
    return entity ? this.toMatchingProfileDto(entity) : null;
  }

  async deleteProfile(userId: string, eventId: string): Promise<void> {
    await this.profileRepo.delete({ userId, eventId });
    await this.cache.invalidateDiscovery(eventId);
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  async discoverFans(
    viewerUserId: string,
    query: DiscoveryQuery,
  ): Promise<DiscoveryResult> {
    const viewerProfile = await this.profileRepo.findOne({
      where: { userId: viewerUserId, eventId: query.eventId },
    });

    if (!viewerProfile) {
      return { cards: [], nextCursor: null, totalEstimate: 0 };
    }

    // Check cache
    const cacheKey = this.cache.buildDiscoveryCacheKey(viewerUserId, query);
    const cached = await this.cache.getDiscovery(cacheKey);
    if (cached) {
      return cached;
    }

    const candidates = await this.fetchCandidates(
      viewerUserId,
      query,
      viewerProfile,
    );

    const cardPromises = candidates.map(async (candidate) => {
      const signals = this.computeSignals(viewerProfile, candidate);
      if (signals.length === 0) return null;

      const compositeScore = this.computeCompositeScore(signals);
      return this.buildDiscoveryCard(
        candidate,
        signals,
        compositeScore,
        query,
      );
    });

    const resolvedCards = await Promise.all(cardPromises);
    const scoredCards: DiscoveryCard[] = resolvedCards.filter(
      (card): card is DiscoveryCard => !!card,
    );

    // Sort by composite score descending
    scoredCards.sort((a, b) => b.compositeScore - a.compositeScore);

    // Cursor-based pagination
    const { page, nextCursor } = this.paginateCards(
      scoredCards,
      query.cursor,
      query.limit,
    );

    const result: DiscoveryResult = {
      cards: page,
      nextCursor,
      totalEstimate: scoredCards.length,
    };

    await this.cache.setDiscovery(cacheKey, result, this.config.discoveryCacheTtlSeconds);

    return result;
  }

  // ─── Match Requests ─────────────────────────────────────────────────────────

  async sendMatchRequest(
    fromUserId: string,
    dto: SendMatchRequest,
  ): Promise<MatchRequest> {
    if (fromUserId === dto.toUserId) {
      throw new BadRequestException('Cannot send match request to yourself');
    }

    // Check target visibility
    const targetProfile = await this.profileRepo.findOne({
      where: { userId: dto.toUserId, eventId: dto.eventId },
    });

    if (!targetProfile || targetProfile.visibility === 'PRIVATE') {
      throw new ForbiddenException('User is not discoverable');
    }

    // Check duplicate
    const existing = await this.requestRepo.findOne({
      where: {
        fromUserId,
        toUserId: dto.toUserId,
        eventId: dto.eventId,
        status: 'PENDING',
      },
    });
    if (existing) {
      throw new BadRequestException('A pending request already exists');
    }

    const viewerProfile = await this.profileRepo.findOne({
      where: { userId: fromUserId, eventId: dto.eventId },
    });

    const signals = viewerProfile
      ? this.computeSignals(viewerProfile, targetProfile)
      : [];

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const entity = this.requestRepo.create({
      requestId: uuidv4(),
      fromUserId,
      toUserId: dto.toUserId,
      eventId: dto.eventId,
      status: 'PENDING',
      messageText: dto.messageText ?? null,
      signals: JSON.stringify(signals),
      expiresAt,
    });

    const saved = await this.requestRepo.save(entity);
    return this.toMatchRequestDto(saved);
  }

  async respondMatchRequest(
    requestId: string,
    responderUserId: string,
    action: 'ACCEPT' | 'DECLINE',
  ): Promise<MatchRequest> {
    const entity = await this.requestRepo.findOne({ where: { requestId } });

    if (!entity) {
      throw new NotFoundException('Match request not found');
    }

    if (entity.toUserId !== responderUserId) {
      throw new ForbiddenException('Not authorized to respond to this request');
    }

    if (entity.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${entity.status}`);
    }

    entity.status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    entity.respondedAt = new Date();

    const saved = await this.requestRepo.save(entity);
    return this.toMatchRequestDto(saved);
  }

  async listMatchRequests(
    userId: string,
    direction: 'INCOMING' | 'OUTGOING',
    eventId?: string,
  ): Promise<MatchRequest[]> {
    const where: Record<string, unknown> = {};

    if (direction === 'INCOMING') {
      where.toUserId = userId;
    } else {
      where.fromUserId = userId;
    }

    if (eventId) where.eventId = eventId;

    const entities = await this.requestRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return entities.map((e) => this.toMatchRequestDto(e));
  }

  // ─── Co-traveler signal (for AI Trip Assistant) ──────────────────────────────

  async getCoTravelerSignal(
    fromCityId: string,
    toCityId: string,
    travelDate: string,  // YYYY-MM-DD
    eventId: string,
  ): Promise<CoTravelerSignal> {
    const routeKey = `${fromCityId}:${toCityId}:${travelDate}`;
    const cached = await this.cache.getCoTravelerSignal(routeKey);
    if (cached) return cached;

    // Count profiles matching this route
    const dateStart = new Date(travelDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(travelDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Raw query for JSONB array filtering (PostgreSQL)
    const rows: Array<{ country_community_id: string }> =
      await this.dataSource.query(
        `
        SELECT country_community_id
        FROM matching_profiles mp
        WHERE mp.event_id = $1
          AND mp.visibility != 'PRIVATE'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(mp.route_city_pairs) AS rcp
            WHERE rcp->>'fromCityId' = $2
              AND rcp->>'toCityId' = $3
              AND (rcp->>'travelDate')::timestamptz BETWEEN $4 AND $5
          )
        LIMIT 100
        `,
        [eventId, fromCityId, toCityId, dateStart.toISOString(), dateEnd.toISOString()],
      );

    const countryCodesSet = new Set(
      rows
        .map((r) => r.country_community_id)
        .filter(Boolean)
        .slice(0, 5),
    );

    const signal: CoTravelerSignal = {
      routeKey,
      eventId,
      count: rows.length,
      sampleCountryCodes: Array.from(countryCodesSet),
      computedAt: new Date().toISOString(),
    };

    await this.cache.setCoTravelerSignal(routeKey, signal, 300); // 5-min TTL

    return signal;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async fetchCandidates(
    viewerUserId: string,
    query: DiscoveryQuery,
    viewerProfile: MatchingProfileEntity,
  ): Promise<MatchingProfileEntity[]> {
    const qb = this.profileRepo
      .createQueryBuilder('mp')
      .where('mp.event_id = :eventId', { eventId: query.eventId })
      .andWhere('mp.user_id != :viewerUserId', { viewerUserId })
      .andWhere("mp.visibility != 'PRIVATE'");

    // Visibility filter: COMMUNITY => same country community
    if (viewerProfile.countryCommunityId) {
      qb.andWhere(
        "(mp.visibility = 'PUBLIC' OR (mp.visibility = 'COMMUNITY' AND mp.country_community_id = :ccId))",
        { ccId: viewerProfile.countryCommunityId },
      );
    } else {
      qb.andWhere("mp.visibility = 'PUBLIC'");
    }

    // Helpers filter
    if (query.filters?.helpersOnly) {
      qb.andWhere('mp.is_helper = true');
    }

    // City filter
    if (query.filters?.cityId) {
      qb.andWhere('mp.cities_attending @> :city::jsonb', {
        city: JSON.stringify([query.filters.cityId]),
      });
    }

    // Match filter
    if (query.filters?.matchId) {
      qb.andWhere('mp.match_ids @> :matchId::jsonb', {
        matchId: JSON.stringify([query.filters.matchId]),
      });
    }

    return qb.take(200).getMany();
  }

  private computeSignals(
    viewer: MatchingProfileEntity,
    candidate: MatchingProfileEntity,
  ): MatchingSignal[] {
    const signals: MatchingSignal[] = [];

    // SAME_MATCH
    const sharedMatches = viewer.matchIds.filter((m) =>
      candidate.matchIds.includes(m),
    );
    if (sharedMatches.length > 0) {
      signals.push({
        signalId: uuidv4(),
        type: 'SAME_MATCH',
        score: Math.min(1, sharedMatches.length * 0.5),
        details: { sharedMatchIds: sharedMatches },
      });
    }

    // SAME_CITY
    const sharedCities = viewer.citiesAttending.filter((c) =>
      candidate.citiesAttending.includes(c),
    );
    if (sharedCities.length > 0) {
      signals.push({
        signalId: uuidv4(),
        type: 'SAME_CITY',
        score: Math.min(1, sharedCities.length * 0.4),
        details: { sharedCityIds: sharedCities },
      });
    }

    // SAME_ROUTE
    const sharedRoutes = viewer.routeCityPairs.filter((vr) =>
      candidate.routeCityPairs.some(
        (cr) =>
          cr.fromCityId === vr.fromCityId && cr.toCityId === vr.toCityId,
      ),
    );
    if (sharedRoutes.length > 0) {
      signals.push({
        signalId: uuidv4(),
        type: 'SAME_ROUTE',
        score: 1,
        details: { routes: sharedRoutes },
      });
    }

    // SAME_DATES (date range overlap)
    const viewerArrival = new Date(viewer.travelDates.arrivalDate);
    const viewerDeparture = new Date(viewer.travelDates.departureDate);
    const candidateArrival = new Date(candidate.travelDates.arrivalDate);
    const candidateDeparture = new Date(candidate.travelDates.departureDate);
    const overlap =
      viewerArrival <= candidateDeparture &&
      candidateArrival <= viewerDeparture;
    if (overlap) {
      const overlapDays =
        (Math.min(
          viewerDeparture.getTime(),
          candidateDeparture.getTime(),
        ) -
          Math.max(
            viewerArrival.getTime(),
            candidateArrival.getTime(),
          )) /
        (1000 * 60 * 60 * 24);
      signals.push({
        signalId: uuidv4(),
        type: 'SAME_DATES',
        score: Math.min(1, overlapDays / 7),
        details: { overlapDays: Math.round(overlapDays) },
      });
    }

    // SHARED_LANGUAGE
    const sharedLangs = viewer.languagesSpoken.filter((l) =>
      candidate.languagesSpoken.includes(l),
    );
    if (sharedLangs.length > 0) {
      signals.push({
        signalId: uuidv4(),
        type: 'SHARED_LANGUAGE',
        score: 1,
        details: { languages: sharedLangs },
      });
    }

    // SAME_COUNTRY_COMMUNITY
    if (
      viewer.countryCommunityId &&
      candidate.countryCommunityId &&
      viewer.countryCommunityId === candidate.countryCommunityId
    ) {
      signals.push({
        signalId: uuidv4(),
        type: 'SAME_COUNTRY_COMMUNITY',
        score: 1,
        details: { communityId: viewer.countryCommunityId },
      });
    }

    // HELPER_MATCH (candidate is a helper who speaks viewer's language)
    if (candidate.isHelper && sharedLangs.length > 0) {
      signals.push({
        signalId: uuidv4(),
        type: 'HELPER_MATCH',
        score: 1,
        details: { languages: sharedLangs },
      });
    }

    return signals;
  }

  private computeCompositeScore(signals: MatchingSignal[]): number {
    let total = 0;
    for (const sig of signals) {
      total += (SIGNAL_WEIGHTS[sig.type] ?? 0) * sig.score;
    }
    // Normalize to [0,1]
    const maxPossible = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
    return Math.min(1, total / maxPossible);
  }

  private async buildDiscoveryCard(
    candidate: MatchingProfileEntity,
    signals: MatchingSignal[],
    compositeScore: number,
    query: DiscoveryQuery,
  ): Promise<DiscoveryCard | null> {
    // Resolve display data (would normally join Fan Profile / helper profile)
    const sharedCities = signals
      .filter((s) => s.type === 'SAME_CITY')
      .flatMap((s) => (s.details as { sharedCityIds: string[] }).sharedCityIds ?? []);

    const sharedMatches = signals
      .filter((s) => s.type === 'SAME_MATCH')
      .flatMap(
        (s) => (s.details as { sharedMatchIds: string[] }).sharedMatchIds ?? [],
      );

    const type =
      candidate.isHelper ? 'HELPER' : 'FAN';

    if (query.filters?.cardType && query.filters.cardType !== type) {
      return null;
    }

    return {
      cardId: uuidv4(),
      type,
      targetUserId: candidate.userId,
      displayName: `Fan_${candidate.userId.slice(0, 6)}`, // placeholder; real impl joins profile
      avatarUrl: null,
      countryCode: null,
      trustTierBadge: candidate.isHelper ? 'LOCAL_HELPER' : null,
      languagesSpoken: candidate.languagesSpoken,
      matchingSignals: signals,
      compositeScore,
      sharedCities,
      sharedMatches,
      isHelper: candidate.isHelper,
      helperOfferings: null,
      deepLinkPath: candidate.isHelper
        ? `/helpers/${candidate.userId}`
        : `/fans/${candidate.userId}`,
      generatedAt: new Date().toISOString(),
    };
  }

  private paginateCards(
    cards: DiscoveryCard[],
    cursor: string | undefined,
    limit: number,
  ): { page: DiscoveryCard[]; nextCursor: string | null } {
    let startIndex = 0;
    if (cursor) {
      const idx = cards.findIndex((c) => c.cardId === cursor);
      if (idx !== -1) startIndex = idx + 1;
    }
    const page = cards.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < cards.length
        ? page[page.length - 1].cardId
        : null;
    return { page, nextCursor };
  }

  // ─── DTO mappers ─────────────────────────────────────────────────────────────

  private toMatchingProfileDto(e: MatchingProfileEntity): MatchingProfile {
    return {
      userId: e.userId,
      eventId: e.eventId,
      visibility: e.visibility as MatchingProfile['visibility'],
      citiesAttending: e.citiesAttending,
      matchIds: e.matchIds,
      travelDates: e.travelDates,
      routeCityPairs: e.routeCityPairs,
      languagesSpoken: e.languagesSpoken,
      countryCommunityId: e.countryCommunityId,
      isHelper: e.isHelper,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  private toMatchRequestDto(e: MatchRequestEntity): MatchRequest {
    return {
      requestId: e.requestId,
      fromUserId: e.fromUserId,
      toUserId: e.toUserId,
      eventId: e.eventId,
      status: e.status as MatchRequest['status'],
      messageText: e.messageText,
      signals: e.signals ? JSON.parse(e.signals) : [],
      createdAt: e.createdAt.toISOString(),
      respondedAt: e.respondedAt ? e.respondedAt.toISOString() : null,
      expiresAt: e.expiresAt.toISOString(),
    };
  }
}