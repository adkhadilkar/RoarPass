import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityChannelEntity } from './entities/community-channel.entity';
import { CommunityMemberEntity } from './entities/community-member.entity';
import {
  CommunityChannel,
  CreateChannelDto,
  UpdateChannelDto,
} from '@roarpass/shared';
import { validateISO6391 } from '../common/validators';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(CommunityChannelEntity)
    private readonly channelRepo: Repository<CommunityChannelEntity>,
    @InjectRepository(CommunityMemberEntity)
    private readonly memberRepo: Repository<CommunityMemberEntity>,
  ) {}

  async create(dto: CreateChannelDto, requesterId: string): Promise<CommunityChannel> {
    if (dto.community_default_language && !validateISO6391(dto.community_default_language)) {
      throw new BadRequestException('Invalid community_default_language: must be ISO 639-1');
    }

    const existing = await this.channelRepo.findOne({
      where: { community_id: dto.community_id, slug: dto.slug },
    });
    if (existing) throw new ConflictException('Channel slug already exists in this community');

    const maxOrder = await this.channelRepo
      .createQueryBuilder('c')
      .select('MAX(c.sort_order)', 'max')
      .where('c.community_id = :id', { id: dto.community_id })
      .getRawOne<{ max: number | null }>();

    const entity = this.channelRepo.create({
      ...dto,
      sort_order: dto.sort_order ?? (maxOrder?.max ?? -1) + 1,
      is_readonly: dto.is_readonly ?? false,
      is_pinned: dto.is_pinned ?? false,
      is_active: true,
    });
    const saved = await this.channelRepo.save(entity);
    return this.toDto(saved);
  }

  async findByCommunity(communityId: string): Promise<CommunityChannel[]> {
    const entities = await this.channelRepo.find({
      where: { community_id: communityId, is_active: true },
      order: { is_pinned: 'DESC', sort_order: 'ASC', name: 'ASC' },
    });
    return entities.map((e) => this.toDto(e));
  }

  async findOne(channelId: string): Promise<CommunityChannel> {
    const entity = await this.channelRepo.findOne({
      where: { channel_id: channelId, is_active: true },
    });
    if (!entity) throw new NotFoundException('Channel not found');
    return this.toDto(entity);
  }

  async update(channelId: string, dto: UpdateChannelDto, requesterId: string): Promise<CommunityChannel> {
    const entity = await this.channelRepo.findOne({ where: { channel_id: channelId } });
    if (!entity) throw new NotFoundException('Channel not found');

    if (dto.community_default_language !== undefined) {
      if (dto.community_default_language && !validateISO6391(dto.community_default_language)) {
        throw new BadRequestException('Invalid community_default_language: must be ISO 639-1');
      }
    }

    Object.assign(entity, dto);
    const saved = await this.channelRepo.save(entity);
    return this.toDto(saved);
  }

  async incrementMessageCount(channelId: string): Promise<void> {
    await this.channelRepo.increment({ channel_id: channelId }, 'message_count', 1);
    await this.channelRepo.update(channelId, { last_message_at: new Date() });
  }

  private toDto(e: CommunityChannelEntity): CommunityChannel {
    return {
      channel_id: e.channel_id,
      community_id: e.community_id,
      type: e.type as any,
      name: e.name,
      slug: e.slug,
      description: e.description,
      community_default_language: e.community_default_language,
      is_readonly: e.is_readonly,
      is_pinned: e.is_pinned,
      sort_order: e.sort_order,
      message_count: e.message_count,
      last_message_at: e.last_message_at?.toISOString() ?? null,
      is_active: e.is_active,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    };
  }
}