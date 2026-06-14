import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { DateTime } from 'luxon';
import {
  CityGuideEntry,
  CreateCityGuideEntry,
  UpdateCityGuideEntry,
  CityGuideQuery,
  CityGuideResponse,
  Match,
  MatchWithViewerTimezone,
  ScheduleFeedQuery,
  ScheduleFeedResponse,
  VisaEntryRequirement,
  CreateVisaEntryRequirement,
  UpdateVisaEntryRequirement,
  VisaIntelQuery,
  VisaIntelResponse,
} from '@roarpass/shared';
import { CityGuideEntryEntity } from './entities/city-guide-entry.entity';
import { MatchEntity } from './entities/match.entity';
import { VisaEntryRequirementEntity } from './entities/visa-entry-requirement.entity';
import { EventRegistryService } from '../event-registry/event-registry.service';

const VISA_DISCLAIMER =
  'Visa and entry information is provided for informational purposes only. ' +
  'Requirements may change without notice. Always verify with the official embassy or ' +
  'consulate of the destination country before travelling. RoarPass accepts no liability ' +
  'for decisions made based on this information.';

@Injectable()
export class OfficialInfoService {
  private readonly logger = new Logger(OfficialInfoService.name);

  constructor(
    @InjectRepository(CityGuideEntryEntity)
    private readonly guideRepo: Repository<CityGuideEntryEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepo: Repository<MatchEntity>,
    @InjectRepository(VisaEntryRequirementEntity)
    private readonly visaRepo: Repository<VisaEntryRequirementEntity>,
    private readonly eventRegistryService: EventRegistryService,
  ) {}

  // ─── City Guides ─────────────────────────────────────────────────────────────

  async listCityGuides(query: CityGuideQuery): Promise<CityGuideResponse> {
    // Validate event exists
    await this.assertEventExists(query.event_id);

    const where: FindManyOptions<CityGuideEntryEntity>['where'] = {
      event_id: query.event_id,
      is_published: true,
    };
    if (query.host_city_id) where.host_city_id = query.host_city_id;
    if (query.category) where.category = query.category;
    if (query.language) where.content_language = query.language;

    const skip = (query.page - 1) * query.page_size;
    const [entities, total] = await this.guideRepo.findAndCount({
      where,
      skip,
      take: query.page_size,
      order: { category: 'ASC', updated_at: 'DESC' },
    });

    return {
      entries: entities.map(this.entityToGuideEntry),
      total,
      page: query.page,
      page_size: query.page_size,
    };
  }

  async getCityGuideEntry(entryId: string): Promise<CityGuideEntry> {
    const entity = await this.guideRepo.findOne({
      where: { entry_id: entryId, is_published: true },
    });
    if (!entity) throw new NotFoundException(`City guide entry ${entryId} not found`);
    return this.entityToGuideEntry(entity);
  }

  // Admin-only
  async createCityGuideEntry(
    data: CreateCityGuideEntry,
    adminUserId: string,
  ): Promise<CityGuideEntry> {
    await this.assertEventExists(data.event_id);
    const entity = this.guideRepo.create({
      ...data,
      created_by: adminUserId,
    });
    const saved = await this.guideRepo.save(entity);
    this.logger.log(`City guide entry created: ${saved.entry_id} by admin ${adminUserId}`);
    return this.entityToGuideEntry(saved);
  }

  async updateCityGuideEntry(
    entryId: string,
    data: UpdateCityGuideEntry,
    adminUserId: string,
  ): Promise<CityGuideEntry> {
    const entity = await this.guideRepo.findOne({ where: { entry_id: entryId } });
    if (!entity) throw new NotFoundException(`City guide entry ${entryId} not found`);
    Object.assign(entity, data);
    const saved = await this.guideRepo.save(entity);
    this.logger.log(`City guide entry updated: ${entryId} by admin ${adminUserId}`);
    return this.entityToGuideEntry(saved);
  }

  async deleteCityGuideEntry(entryId: string, adminUserId: string): Promise<void> {
    const entity = await this.guideRepo.findOne({ where: { entry_id: entryId } });
    if (!entity) throw new NotFoundException(`City guide entry ${entryId} not found`);
    entity.is_published = false; // soft delete
    await this.guideRepo.save(entity);
    this.logger.log(`City guide entry soft-deleted: ${entryId} by admin ${adminUserId}`);
  }

  // ─── Match / Schedule Feed ────────────────────────────────────────────────────

  async getScheduleFeed(query: ScheduleFeedQuery): Promise<ScheduleFeedResponse> {
    await this.assertEventExists(query.event_id);

    const viewerTz = this.resolveViewerTimezone(query.viewer_timezone);
    const where: FindManyOptions<MatchEntity>['where'] = {
      event_id: query.event_id,
    };
    if (query.host_city_id) where.host_city_id = query.host_city_id;
    if (query.status) where.status = query.status;
    if (query.from_date && query.to_date) {
      where.kickoff_utc = Between(new Date(query.from_date), new Date(query.to_date));
    }

    const skip = (query.page - 1) * query.page_size;
    const [entities, total] = await this.matchRepo.findAndCount({
      where,
      skip,
      take: query.page_size,
      order: { kickoff_utc: 'ASC' },
    });

    // Filter by team if requested
    let filtered = entities;
    if (query.team_id) {
      filtered = entities.filter(
        (m) =>
          m.home_team_id === query.team_id || m.away_team_id === query.team_id,
      );
    }

    const matches = filtered.map((e) =>
      this.entityToMatchWithViewerTz(e, viewerTz),
    );

    return {
      matches,
      total: query.team_id ? filtered.length : total,
      page: query.page,
      page_size: query.page_size,
      event_id: query.event_id,
    };
  }

  async getMatch(matchId: string, viewerTimezone?: string): Promise<MatchWithViewerTimezone> {
    const entity = await this.matchRepo.findOne({ where: { match_id: matchId } });
    if (!entity) throw new NotFoundException(`Match ${matchId} not found`);
    const tz = this.resolveViewerTimezone(viewerTimezone);
    return this.entityToMatchWithViewerTz(entity, tz);
  }

  // Admin-only
  async upsertMatch(data: Partial<Match> & { match_id?: string }, adminUserId: string): Promise<MatchWithViewerTimezone> {
    let entity: MatchEntity;
    if (data.match_id) {
      entity = await this.matchRepo.findOne({ where: { match_id: data.match_id } }) ?? this.matchRepo.create();
    } else {
      entity = this.matchRepo.create();
    }
    Object.assign(entity, data);
    const saved = await this.matchRepo.save(entity);
    this.logger.log(`Match upserted: ${saved.match_id} by admin ${adminUserId}`);
    return this.entityToMatchWithViewerTz(saved, 'UTC');
  }

  // ─── Visa Intelligence ────────────────────────────────────────────────────────

  async getVisaIntelligence(query: VisaIntelQuery): Promise<VisaIntelResponse> {
    await this.assertEventExists(query.event_id);

    const where: FindManyOptions<VisaEntryRequirementEntity>['where'] = {
      event_id: query.event_id,
      passport_country_code: query.passport_country_code.toUpperCase(),
      is_active: true,
    };
    if (query.destination_country_code) {
      where.destination_country_code = query.destination_country_code.toUpperCase();
    }

    const entities = await this.visaRepo.find({
      where,
      order: { destination_country_code: 'ASC' },
    });

    const requirements = entities.map(this.entityToVisaRequirement);
    const lastUpdated =
      requirements.length > 0
        ? requirements.reduce((latest, r) =>
            r.updated_at > latest.updated_at ? r : latest,
          ).updated_at
        : new Date().toISOString();

    return {
      passport_country_code: query.passport_country_code.toUpperCase(),
      requirements,
      disclaimer: VISA_DISCLAIMER,
      last_updated: lastUpdated,
    };
  }

  // Admin-only
  async createVisaRequirement(
    data: CreateVisaEntryRequirement,
    adminUserId: string,
  ): Promise<VisaEntryRequirement> {
    await this.assertEventExists(data.event_id);
    const entity = this.visaRepo.create({
      ...data,
      passport_country_code: data.passport_country_code.toUpperCase(),
      destination_country_code: data.destination_country_code.toUpperCase(),
    });
    const saved = await this.visaRepo.save(entity);
    this.logger.log(`Visa requirement created: ${saved.requirement_id} by admin ${adminUserId}`);
    return this.entityToVisaRequirement(saved);
  }

  async updateVisaRequirement(
    requirementId: string,
    data: UpdateVisaEntryRequirement,
    adminUserId: string,
  ): Promise<VisaEntryRequirement> {
    const entity = await this.visaRepo.findOne({
      where: { requirement_id: requirementId },
    });
    if (!entity) throw new NotFoundException(`Visa requirement ${requirementId} not found`);
    Object.assign(entity, data);
    const saved = await this.visaRepo.save(entity);
    this.logger.log(`Visa requirement updated: ${requirementId} by admin ${adminUserId}`);
    return this.entityToVisaRequirement(saved);
  }

  async deleteVisaRequirement(requirementId: string, adminUserId: string): Promise<void> {
    const entity = await this.visaRepo.findOne({
      where: { requirement_id: requirementId },
    });
    if (!entity) throw new NotFoundException(`Visa requirement ${requirementId} not found`);
    entity.is_active = false; // soft delete
    await this.visaRepo.save(entity);
    this.logger.log(`Visa requirement soft-deleted: ${requirementId} by admin ${adminUserId}`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private async assertEventExists(eventId: string): Promise<void> {
    const exists = await this.eventRegistryService.eventExists(eventId);
    if (!exists) throw new NotFoundException(`Event ${eventId} not found`);
  }

  private resolveViewerTimezone(tz?: string): string {
    if (!tz) return 'UTC';
    // Validate it's a known IANA TZ by trying to create a DateTime in it
    const dt = DateTime.now().setZone(tz);
    if (!dt.isValid) {
      this.logger.warn(`Invalid timezone supplied: ${tz}, falling back to UTC`);
      return 'UTC';
    }
    return tz;
  }

  private entityToGuideEntry(e: CityGuideEntryEntity): CityGuideEntry {
    return {
      entry_id: e.entry_id,
      event_id: e.event_id,
      host_city_id: e.host_city_id,
      city_name: e.city_name,
      country_code: e.country_code,
      category: e.category,
      title: e.title,
      content: e.content,
      content_language: e.content_language,
      official_source_url: e.official_source_url,
      is_published: e.is_published,
      last_verified_at: e.last_verified_at?.toISOString() ?? null,
      created_by: e.created_by,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    };
  }

  private entityToMatchWithViewerTz(
    e: MatchEntity,
    viewerTz: string,
  ): MatchWithViewerTimezone {
    const kickoffUtcStr = e.kickoff_utc.toISOString();
    const kickoffDt = DateTime.fromISO(kickoffUtcStr, { zone: 'UTC' });
    const kickoffLocal = kickoffDt.setZone(e.local_timezone).toISO() ?? kickoffUtcStr;
    const kickoffViewerLocal = kickoffDt.setZone(viewerTz).toISO() ?? kickoffUtcStr;

    return {
      match_id: e.match_id,
      event_id: e.event_id,
      host_city_id: e.host_city_id,
      venue_name: e.venue_name,
      venue_address: e.venue_address,
      home_team: e.home_team ? JSON.parse(e.home_team) : null,
      away_team: e.away_team ? JSON.parse(e.away_team) : null,
      match_round: e.match_round,
      match_number: e.match_number,
      kickoff_utc: kickoffUtcStr,
      kickoff_local: kickoffLocal,
      local_timezone: e.local_timezone,
      kickoff_viewer_local: kickoffViewerLocal,
      viewer_timezone: viewerTz,
      status: e.status,
      stadium_gates_open_minutes_before: e.stadium_gates_open_minutes_before,
      attendance_capacity: e.attendance_capacity,
      ticket_info_url: e.ticket_info_url,
      broadcast_info: e.broadcast_info ?? [],
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    };
  }

  private entityToVisaRequirement(e: VisaEntryRequirementEntity): VisaEntryRequirement {
    return {
      requirement_id: e.requirement_id,
      event_id: e.event_id,
      passport_country_code: e.passport_country_code,
      destination_country_code: e.destination_country_code,
      requirement_type: e.requirement_type,
      max_stay_days: e.max_stay_days,
      notes: e.notes,
      official_portal_url: e.official_portal_url,
      embassy_url: e.embassy_url,
      processing_time_days_min: e.processing_time_days_min,
      processing_time_days_max: e.processing_time_days_max,
      fee_usd: e.fee_usd,
      requires_invitation: e.requires_invitation,
      data_source: e.data_source,
      last_verified_at: e.last_verified_at.toISOString(),
      valid_until: e.valid_until?.toISOString() ?? null,
      is_active: e.is_active,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    };
  }
}