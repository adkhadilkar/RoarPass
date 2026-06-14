/**
 * Repository layer for Official Information & Visa Intelligence
 * Chunk: official-info-layer
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, MoreThanOrEqual } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import {
  EventGuide,
  CityGuide,
  MatchInfo,
  VisaRequirement,
  OfficialPortalLink,
  GetEventGuidesParams,
  GetCityGuidesParams,
  GetMatchScheduleParams,
  GetVisaRequirementsParams,
  GetOfficialPortalLinksParams,
  GuideSection,
  InfoSourceTrust,
  MatchStatus,
} from '@roarpass/shared';
import {
  EventGuideEntity,
  CityGuideEntity,
  MatchInfoEntity,
  VisaRequirementEntity,
  OfficialPortalLinkEntity,
} from './entities';

const CACHE_TTL_SECONDS = {
  EVENT_GUIDE: 3600,       // 1 hour
  CITY_GUIDE: 3600,
  MATCH_SCHEDULE: 60,      // 1 minute – live scores can change
  VISA_REQUIREMENT: 86400, // 24 hours – official info changes rarely
  PORTAL_LINKS: 86400,
} as const;

@Injectable()
export class OfficialInfoRepository {
  private readonly logger = new Logger(OfficialInfoRepository.name);

  constructor(
    @InjectRepository(EventGuideEntity)
    private readonly eventGuideRepo: Repository<EventGuideEntity>,
    @InjectRepository(CityGuideEntity)
    private readonly cityGuideRepo: Repository<CityGuideEntity>,
    @InjectRepository(MatchInfoEntity)
    private readonly matchInfoRepo: Repository<MatchInfoEntity>,
    @InjectRepository(VisaRequirementEntity)
    private readonly visaRepo: Repository<VisaRequirementEntity>,
    @InjectRepository(OfficialPortalLinkEntity)
    private readonly portalLinkRepo: Repository<OfficialPortalLinkEntity>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Event Guides ───────────────────────────────────────────────────────────

  async findEventGuides(params: GetEventGuidesParams): Promise<EventGuide[]> {
    const cacheKey = `official-info:event-guides:${JSON.stringify(params)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached) as EventGuide[];
    }

    const where: FindOptionsWhere<EventGuideEntity> = {
      eventId: params.eventId,
      isActive: true,
    };
    if (params.hostCityId) where.hostCityId = params.hostCityId;
    if (params.section) where.section = params.section;

    const entities = await this.eventGuideRepo.find({ where, order: { section: 'ASC' } });
    const result = entities.map((e) => this.mapEventGuide(e, params.language));

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS.EVENT_GUIDE, JSON.stringify(result));
    return result;
  }

  async upsertEventGuide(data: Partial<EventGuideEntity>): Promise<EventGuide> {
    const entity = await this.eventGuideRepo.save(data);
    await this.invalidateEventGuideCache(entity.eventId);
    return this.mapEventGuide(entity);
  }

  // ─── City Guides ────────────────────────────────────────────────────────────

  async findCityGuides(params: GetCityGuidesParams): Promise<CityGuide[]> {
    const cacheKey = `official-info:city-guides:${JSON.stringify(params)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as CityGuide[];

    const where: FindOptionsWhere<CityGuideEntity> = {
      cityId: params.cityId,
      isActive: true,
    };
    if (params.section) where.section = params.section;

    const entities = await this.cityGuideRepo.find({ where, order: { section: 'ASC' } });
    const result = entities.map((e) => this.mapCityGuide(e, params.language));

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS.CITY_GUIDE, JSON.stringify(result));
    return result;
  }

  // ─── Match Schedule ─────────────────────────────────────────────────────────

  async findMatches(params: GetMatchScheduleParams): Promise<MatchInfo[]> {
    const cacheKey = `official-info:matches:${JSON.stringify(params)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as MatchInfo[];

    const qb = this.matchInfoRepo
      .createQueryBuilder('m')
      .where('m.eventId = :eventId', { eventId: params.eventId });

    if (params.fromDate) qb.andWhere('m.kickoffUtc >= :from', { from: params.fromDate });
    if (params.toDate) qb.andWhere('m.kickoffUtc <= :to', { to: params.toDate });
    if (params.teamId) {
      qb.andWhere('(m.homeTeamId = :tid OR m.awayTeamId = :tid)', { tid: params.teamId });
    }
    if (params.hostCityId) {
      qb.andWhere('m.hostCityId = :cityId', { cityId: params.hostCityId });
    }

    qb.orderBy('m.kickoffUtc', 'ASC');

    const entities = await qb.getMany();
    const result = entities.map((e) => this.mapMatchInfo(e, params.viewerTimezone));

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS.MATCH_SCHEDULE, JSON.stringify(result));
    return result;
  }

  async upsertMatch(data: Partial<MatchInfoEntity>): Promise<MatchInfo> {
    const entity = await this.matchInfoRepo.save(data);
    await this.invalidateMatchCache(entity.eventId);
    return this.mapMatchInfo(entity);
  }

  // ─── Visa Requirements ──────────────────────────────────────────────────────

  async findVisaRequirements(params: GetVisaRequirementsParams): Promise<VisaRequirement[]> {
    const cacheKey = `official-info:visa:${params.nationalityCode}:${params.destinationCountryCode}:${params.eventId ?? 'none'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as VisaRequirement[];

    const where: FindOptionsWhere<VisaRequirementEntity> = {
      nationalityCode: params.nationalityCode,
      destinationCountryCode: params.destinationCountryCode,
    };

    const entities = await this.visaRepo.find({
      where,
      order: { lastVerifiedAt: 'DESC' },
    });

    // If event-specific record exists, prefer it; otherwise return general
    const eventSpecific = entities.filter((e) => e.eventId === params.eventId);
    const result = (eventSpecific.length > 0 ? eventSpecific : entities).map((e) =>
      this.mapVisaRequirement(e),
    );

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS.VISA_REQUIREMENT, JSON.stringify(result));
    return result;
  }

  async upsertVisaRequirement(data: Partial<VisaRequirementEntity>): Promise<VisaRequirement> {
    const entity = await this.visaRepo.save(data);
    await this.invalidateVisaCache(entity.nationalityCode, entity.destinationCountryCode);
    return this.mapVisaRequirement(entity);
  }

  // ─── Official Portal Links ──────────────────────────────────────────────────

  async findPortalLinks(params: GetOfficialPortalLinksParams): Promise<OfficialPortalLink[]> {
    const cacheKey = `official-info:portal-links:${params.scope}:${params.scopeId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as OfficialPortalLink[];

    const entities = await this.portalLinkRepo.find({
      where: { scope: params.scope, scopeId: params.scopeId, isActive: true },
      order: { trustLevel: 'DESC' },
    });

    const result = entities.map((e) => this.mapPortalLink(e, params.language));

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS.PORTAL_LINKS, JSON.stringify(result));
    return result;
  }

  // ─── Cache Invalidation ─────────────────────────────────────────────────────

  async invalidateEventGuideCache(eventId: string): Promise<void> {
    const pattern = `official-info:event-guides:*${eventId}*`;
    await this.deleteByPattern(pattern);
  }

  async invalidateMatchCache(eventId: string): Promise<void> {
    const pattern = `official-info:matches:*${eventId}*`;
    await this.deleteByPattern(pattern);
  }

  async invalidateVisaCache(nationalityCode: string, destinationCountryCode: string): Promise<void> {
    const pattern = `official-info:visa:${nationalityCode}:${destinationCountryCode}:*`;
    await this.deleteByPattern(pattern);
  }

  private async deleteByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ─── Mapping Helpers ────────────────────────────────────────────────────────

  private mapEventGuide(entity: EventGuideEntity, language?: string): EventGuide {
    const localizedContent = this.resolveLocalization(entity.localizations, language);
    return {
      guideId: entity.guideId,
      eventId: entity.eventId,
      hostCityId: entity.hostCityId,
      contentType: entity.contentType,
      section: entity.section,
      sourceText: localizedContent?.body ?? entity.sourceText,
      localizations: entity.localizations ?? [],
      trustLevel: entity.trustLevel,
      sources: entity.sources ?? [],
      richContent: entity.richContent,
      lastUpdatedAt: entity.lastUpdatedAt,
      lastVerifiedAt: entity.lastVerifiedAt,
      isActive: entity.isActive,
      dataProvenanceBadge: entity.dataProvenanceBadge,
    };
  }

  private mapCityGuide(entity: CityGuideEntity, language?: string): CityGuide {
    const localizedContent = this.resolveLocalization(entity.localizations, language);
    return {
      guideId: entity.guideId,
      cityId: entity.cityId,
      countryCode: entity.countryCode,
      contentType: entity.contentType,
      section: entity.section,
      sourceText: localizedContent?.body ?? entity.sourceText,
      localizations: entity.localizations ?? [],
      trustLevel: entity.trustLevel,
      sources: entity.sources ?? [],
      richContent: entity.richContent,
      lastUpdatedAt: entity.lastUpdatedAt,
      lastVerifiedAt: entity.lastVerifiedAt,
      isActive: entity.isActive,
      dataProvenanceBadge: entity.dataProvenanceBadge,
    };
  }

  private mapMatchInfo(entity: MatchInfoEntity, viewerTimezone?: string): MatchInfo {
    return {
      matchId: entity.matchId,
      eventId: entity.eventId,
      matchNumber: entity.matchNumber,
      stage: entity.stage,
      homeTeam: entity.homeTeam,
      awayTeam: entity.awayTeam,
      venue: entity.venue,
      kickoffUtc: entity.kickoffUtc,
      kickoffLocal: entity.kickoffLocal,
      hostCityTimezone: entity.hostCityTimezone,
      status: entity.status,
      score: entity.score,
      broadcastInfo: entity.broadcastInfo,
      lastUpdatedAt: entity.lastUpdatedAt,
    };
  }

  private mapVisaRequirement(entity: VisaRequirementEntity): VisaRequirement {
    return {
      requirementId: entity.requirementId,
      nationalityCode: entity.nationalityCode,
      destinationCountryCode: entity.destinationCountryCode,
      requirementType: entity.requirementType,
      officialPortalUrl: entity.officialPortalUrl,
      embassyUrl: entity.embassyUrl,
      visaFreeDays: entity.visaFreeDays,
      conditions: entity.conditions ?? [],
      specialEventNotes: entity.specialEventNotes,
      sources: entity.sources ?? [],
      trustLevel: entity.trustLevel,
      legalDisclaimer: entity.legalDisclaimer,
      lastVerifiedAt: entity.lastVerifiedAt,
      expiresAt: entity.expiresAt,
      localizations: entity.localizations ?? [],
      dataProvenanceBadge: entity.dataProvenanceBadge,
    };
  }

  private mapPortalLink(entity: OfficialPortalLinkEntity, language?: string): OfficialPortalLink {
    const localized = this.resolveLocalization(entity.localizations, language);
    return {
      linkId: entity.linkId,
      scope: entity.scope,
      scopeId: entity.scopeId,
      label: localized?.title ?? entity.label,
      url: entity.url,
      authorityCountryCode: entity.authorityCountryCode,
      trustLevel: entity.trustLevel,
      lastVerifiedAt: entity.lastVerifiedAt,
      isActive: entity.isActive,
      localizations: entity.localizations ?? [],
    };
  }

  private resolveLocalization(
    localizations: Array<{ language: string; title?: string; body?: string }> | null | undefined,
    language?: string,
  ) {
    if (!language || !localizations?.length) return null;
    return localizations.find((l) => l.language === language) ?? null;
  }
}