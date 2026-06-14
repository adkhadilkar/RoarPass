import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull } from 'typeorm';
import { CommunityEntity } from './entities/community.entity';
import { CommunityMemberEntity } from './entities/community-member.entity';
import {
  Community,
  CommunitySummary,
  CreateCommunityDto,
  UpdateCommunityDto,
  ListCommunitiesQuery,
  PaginatedResponse,
  JoinStatus,
} from '@roarpass/shared';
import { sanitizeSlug, validateISO3166Alpha2, validateISO6391 } from '../common/validators';

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(CommunityEntity)
    private readonly communityRepo: Repository<CommunityEntity>,
    @InjectRepository(CommunityMemberEntity)
    private readonly memberRepo: Repository<CommunityMemberEntity>,
  ) {}

  async create(dto: CreateCommunityDto, requesterId: string): Promise<Community> {
    // Input validation
    const slug = sanitizeSlug(dto.slug);
    if (!slug) throw new BadRequestException('Invalid slug');

    if (dto.country_code && !validateISO3166Alpha2(dto.country_code)) {
      throw new BadRequestException('Invalid country_code: must be ISO 3166-1 alpha-2');
    }
    if (dto.community_default_language && !validateISO6391(dto.community_default_language)) {
      throw new BadRequestException('Invalid community_default_language: must be ISO 639-1');
    }

    // Uniqueness check
    const existing = await this.communityRepo.findOne({
      where: { event_id: dto.event_id, slug },
    });
    if (existing) throw new ConflictException('Community slug already exists for this event');

    // Validate parent if CITY type
    if (dto.type === 'CITY' && dto.parent_community_id) {
      const parent = await this.communityRepo.findOne({
        where: { community_id: dto.parent_community_id, event_id: dto.event_id, type: 'COUNTRY' },
      });
      if (!parent) throw new BadRequestException('Parent community not found or is not a COUNTRY community');
    }

    const entity = this.communityRepo.create({
      ...dto,
      slug,
      affinity_tags: dto.affinity_tags ?? [],
      visibility: dto.visibility ?? 'PUBLIC',
      member_count: 0,
      is_active: true,
    });

    const saved = await this.communityRepo.save(entity);
    return this.toDto(saved);
  }

  async findAll(
    query: ListCommunitiesQuery,
    viewerId: string | null,
  ): Promise<PaginatedResponse<CommunitySummary>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
      event_id: query.event_id,
      is_active: true,
      parent_community_id: IsNull(), // top-level only; sub-communities fetched on demand
    };
    if (query.type) where.type = query.type;
    if (query.country_code) where.country_code = query.country_code.toUpperCase();
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [entities, total] = await this.communityRepo.findAndCount({
      where,
      take: limit,
      skip,
      order: { member_count: 'DESC', name: 'ASC' },
    });

    // Fetch viewer's join statuses in bulk
    const joinStatuses = viewerId
      ? await this.getBulkJoinStatus(
          entities.map((e) => e.community_id),
          viewerId,
        )
      : {};

    const data = entities.map((e) => this.toSummaryDto(e, joinStatuses[e.community_id] ?? 'NONE'));

    return { data, total, page, limit, has_more: skip + entities.length < total };
  }

  async findOne(communityId: string, viewerId: string | null): Promise<Community & { join_status: JoinStatus }> {
    const entity = await this.communityRepo.findOne({
      where: { community_id: communityId, is_active: true },
    });
    if (!entity) throw new NotFoundException('Community not found');

    const join_status = viewerId
      ? await this.getJoinStatus(communityId, viewerId)
      : 'NONE';

    return { ...this.toDto(entity), join_status };
  }

  async findBySlug(eventId: string, slug: string, viewerId: string | null) {
    const entity = await this.communityRepo.findOne({
      where: { event_id: eventId, slug, is_active: true },
    });
    if (!entity) throw new NotFoundException('Community not found');

    const join_status = viewerId
      ? await this.getJoinStatus(entity.community_id, viewerId)
      : 'NONE';

    return { ...this.toDto(entity), join_status };
  }

  async findSubCommunities(parentId: string, viewerId: string | null): Promise<CommunitySummary[]> {
    const parent = await this.communityRepo.findOne({ where: { community_id: parentId } });
    if (!parent) throw new NotFoundException('Parent community not found');

    const entities = await this.communityRepo.find({
      where: { parent_community_id: parentId, is_active: true },
      order: { member_count: 'DESC', name: 'ASC' },
    });

    const joinStatuses = viewerId
      ? await this.getBulkJoinStatus(
          entities.map((e) => e.community_id),
          viewerId,
        )
      : {};

    return entities.map((e) => this.toSummaryDto(e, joinStatuses[e.community_id] ?? 'NONE'));
  }

  async update(communityId: string, dto: UpdateCommunityDto, requesterId: string): Promise<Community> {
    const entity = await this.communityRepo.findOne({ where: { community_id: communityId } });
    if (!entity) throw new NotFoundException('Community not found');

    if (dto.community_default_language && !validateISO6391(dto.community_default_language)) {
      throw new BadRequestException('Invalid community_default_language: must be ISO 639-1');
    }

    Object.assign(entity, dto);
    const saved = await this.communityRepo.save(entity);
    return this.toDto(saved);
  }

  async deactivate(communityId: string, requesterId: string): Promise<void> {
    const entity = await this.communityRepo.findOne({ where: { community_id: communityId } });
    if (!entity) throw new NotFoundException('Community not found');
    entity.is_active = false;
    await this.communityRepo.save(entity);
  }

  async incrementMemberCount(communityId: string, delta: number): Promise<void> {
    await this.communityRepo.increment({ community_id: communityId }, 'member_count', delta);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async getJoinStatus(communityId: string, userId: string): Promise<JoinStatus> {
    const m = await this.memberRepo.findOne({
      where: { community_id: communityId, user_id: userId },
    });
    return m ? m.join_status : 'NONE';
  }

  private async getBulkJoinStatus(
    communityIds: string[],
    userId: string,
  ): Promise<Record<string, JoinStatus>> {
    if (!communityIds.length) return {};
    const memberships = await this.memberRepo.find({
      where: communityIds.map((id) => ({ community_id: id, user_id: userId })),
    });
    const map: Record<string, JoinStatus> = {};
    for (const m of memberships) {
      map[m.community_id] = m.join_status;
    }
    return map;
  }

  private toDto(e: CommunityEntity): Community {
    return {
      community_id: e.community_id,
      event_id: e.event_id,
      type: e.type as any,
      name: e.name,
      slug: e.slug,
      description: e.description,
      country_code: e.country_code,
      city_id: e.city_id,
      parent_community_id: e.parent_community_id,
      affinity_tags: e.affinity_tags,
      visibility: e.visibility as any,
      community_default_language: e.community_default_language,
      member_count: e.member_count,
      banner_image_url: e.banner_image_url,
      icon_url: e.icon_url,
      is_active: e.is_active,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    };
  }

  private toSummaryDto(e: CommunityEntity, join_status: JoinStatus): CommunitySummary {
    return {
      community_id: e.community_id,
      event_id: e.event_id,
      type: e.type as any,
      name: e.name,
      slug: e.slug,
      country_code: e.country_code,
      city_id: e.city_id,
      parent_community_id: e.parent_community_id,
      member_count: e.member_count,
      banner_image_url: e.banner_image_url,
      icon_url: e.icon_url,
      join_status,
    };
  }
}