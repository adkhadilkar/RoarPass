import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, ILike, Between } from 'typeorm';
import {
  BusinessPartner,
  NativeMenuItem,
  FanDiscount,
  GroupBookingConfig,
  SponsoredPlacement,
  PartnerSearchQuery,
  PartnerVerificationStatus,
  SponsoredPlacementZone,
} from '@roarpass/shared';
import {
  BusinessPartnerEntity,
  NativeMenuItemEntity,
  FanDiscountEntity,
  GroupBookingConfigEntity,
  SponsoredPlacementEntity,
} from './entities';

@Injectable()
export class BusinessPartnerRepository {
  constructor(
    @InjectRepository(BusinessPartnerEntity)
    private readonly partnerRepo: Repository<BusinessPartnerEntity>,
    @InjectRepository(NativeMenuItemEntity)
    private readonly menuRepo: Repository<NativeMenuItemEntity>,
    @InjectRepository(FanDiscountEntity)
    private readonly discountRepo: Repository<FanDiscountEntity>,
    @InjectRepository(GroupBookingConfigEntity)
    private readonly groupBookingRepo: Repository<GroupBookingConfigEntity>,
    @InjectRepository(SponsoredPlacementEntity)
    private readonly placementRepo: Repository<SponsoredPlacementEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Partner CRUD ───────────────────────────────────────────────────────────

  async create(data: Omit<BusinessPartner, 'partner_id' | 'created_at' | 'updated_at'>): Promise<BusinessPartnerEntity> {
    const entity = this.partnerRepo.create({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return this.partnerRepo.save(entity);
  }

  async findById(partnerId: string): Promise<BusinessPartnerEntity | null> {
    return this.partnerRepo.findOne({
      where: { partner_id: partnerId },
    });
  }

  async findByOwner(ownerUserId: string): Promise<BusinessPartnerEntity[]> {
    return this.partnerRepo.find({
      where: { owner_user_id: ownerUserId, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    partnerId: string,
    data: Partial<BusinessPartner>,
  ): Promise<BusinessPartnerEntity | null> {
    await this.partnerRepo.update(
      { partner_id: partnerId },
      { ...data, updated_at: new Date().toISOString() },
    );
    return this.findById(partnerId);
  }

  async updateVerificationStatus(
    partnerId: string,
    status: PartnerVerificationStatus,
    extra?: {
      reason?: string;
      verified_at?: string;
      suspended_at?: string;
    },
  ): Promise<BusinessPartnerEntity | null> {
    await this.partnerRepo.update(
      { partner_id: partnerId },
      {
        verification_status: status,
        suspension_reason: extra?.reason,
        verified_at: extra?.verified_at,
        suspended_at: extra?.suspended_at,
        updated_at: new Date().toISOString(),
      },
    );
    return this.findById(partnerId);
  }

  async search(query: PartnerSearchQuery): Promise<{ data: BusinessPartnerEntity[]; total: number }> {
    const qb = this.partnerRepo
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .andWhere('p.verification_status = :status', { status: PartnerVerificationStatus.VERIFIED });

    if (query.q) {
      qb.andWhere('(p.business_name ILIKE :q OR p.description ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    if (query.categories?.length) {
      qb.andWhere('p.categories && :categories', { categories: query.categories });
    }

    if (query.country_community_id) {
      qb.andWhere(':cid = ANY(p.country_community_ids)', { cid: query.country_community_id });
    }

    if (query.event_id) {
      qb.andWhere(':eid = ANY(p.event_ids)', { eid: query.event_id });
    }

    if (query.tier) {
      qb.andWhere('p.tier = :tier', { tier: query.tier });
    }

    if (query.has_fan_discount) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM fan_discounts d WHERE d.partner_id = p.partner_id AND d.is_active = true AND d.valid_until > NOW())',
      );
    }

    if (query.has_group_booking) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM group_booking_configs gb WHERE gb.partner_id = p.partner_id)',
      );
    }

    if (query.lat !== undefined && query.lng !== undefined && query.radius_km) {
      qb.andWhere(
        `earth_distance(ll_to_earth(p.address_latitude, p.address_longitude), ll_to_earth(:lat, :lng)) <= :radius_m`,
        { lat: query.lat, lng: query.lng, radius_m: query.radius_km * 1000 },
      );
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('p.tier', 'DESC')
      .addOrderBy('p.fan_rating', 'DESC', 'NULLS LAST')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    return { data, total };
  }

  // ─── Menu Items ─────────────────────────────────────────────────────────────

  async createMenuItem(data: Omit<NativeMenuItem, 'item_id' | 'created_at' | 'updated_at'>): Promise<NativeMenuItemEntity> {
    const entity = this.menuRepo.create({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return this.menuRepo.save(entity);
  }

  async findMenuItems(partnerId: string): Promise<NativeMenuItemEntity[]> {
    return this.menuRepo.find({
      where: { partner_id: partnerId, is_available: true },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async updateMenuItem(
    itemId: string,
    partnerId: string,
    data: Partial<NativeMenuItem>,
  ): Promise<NativeMenuItemEntity | null> {
    await this.menuRepo.update(
      { item_id: itemId, partner_id: partnerId },
      { ...data, updated_at: new Date().toISOString() },
    );
    return this.menuRepo.findOne({ where: { item_id: itemId, partner_id: partnerId } });
  }

  async deleteMenuItem(itemId: string, partnerId: string): Promise<void> {
    await this.menuRepo.update(
      { item_id: itemId, partner_id: partnerId },
      { is_available: false, updated_at: new Date().toISOString() },
    );
  }

  // ─── Fan Discounts ───────────────────────────────────────────────────────────

  async createDiscount(data: Omit<FanDiscount, 'discount_id' | 'redemptions_count' | 'created_at' | 'updated_at'>): Promise<FanDiscountEntity> {
    const entity = this.discountRepo.create({
      ...data,
      redemptions_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return this.discountRepo.save(entity);
  }

  async findDiscounts(partnerId: string): Promise<FanDiscountEntity[]> {
    return this.discountRepo.find({
      where: { partner_id: partnerId },
      order: { created_at: 'DESC' },
    });
  }

  async findActiveDiscounts(partnerId: string, now: Date): Promise<FanDiscountEntity[]> {
    return this.discountRepo
      .createQueryBuilder('d')
      .where('d.partner_id = :partnerId', { partnerId })
      .andWhere('d.is_active = true')
      .andWhere('d.valid_from <= :now', { now })
      .andWhere('d.valid_until >= :now', { now })
      .getMany();
  }

  async incrementDiscountRedemption(discountId: string): Promise<void> {
    await this.discountRepo.increment({ discount_id: discountId }, 'redemptions_count', 1);
  }

  async updateDiscount(
    discountId: string,
    partnerId: string,
    data: Partial<FanDiscount>,
  ): Promise<FanDiscountEntity | null> {
    await this.discountRepo.update(
      { discount_id: discountId, partner_id: partnerId },
      { ...data, updated_at: new Date().toISOString() },
    );
    return this.discountRepo.findOne({ where: { discount_id: discountId, partner_id: partnerId } });
  }

  // ─── Group Booking ───────────────────────────────────────────────────────────

  async upsertGroupBookingConfig(
    partnerId: string,
    data: Omit<GroupBookingConfig, 'config_id' | 'partner_id'>,
  ): Promise<GroupBookingConfigEntity> {
    const existing = await this.groupBookingRepo.findOne({ where: { partner_id: partnerId } });
    if (existing) {
      await this.groupBookingRepo.update({ partner_id: partnerId }, data);
      return this.groupBookingRepo.findOne({ where: { partner_id: partnerId } }) as Promise<GroupBookingConfigEntity>;
    }
    const entity = this.groupBookingRepo.create({ ...data, partner_id: partnerId });
    return this.groupBookingRepo.save(entity);
  }

  async findGroupBookingConfig(partnerId: string): Promise<GroupBookingConfigEntity | null> {
    return this.groupBookingRepo.findOne({ where: { partner_id: partnerId } });
  }

  // ─── Sponsored Placements ────────────────────────────────────────────────────

  async createPlacement(data: Omit<SponsoredPlacement, 'placement_id' | 'impression_count' | 'click_count' | 'created_at' | 'updated_at'>): Promise<SponsoredPlacementEntity> {
    const entity = this.placementRepo.create({
      ...data,
      impression_count: 0,
      click_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return this.placementRepo.save(entity);
  }

  async findActivePlacementsForZone(
    zone: SponsoredPlacementZone,
    now: Date,
    eventId?: string,
    communityId?: string,
  ): Promise<SponsoredPlacementEntity[]> {
    const qb = this.placementRepo
      .createQueryBuilder('sp')
      .where('sp.zone = :zone', { zone })
      .andWhere('sp.is_active = true')
      .andWhere('sp.starts_at <= :now', { now })
      .andWhere('sp.ends_at >= :now', { now });

    if (eventId) {
      qb.andWhere('(sp.event_ids IS NULL OR :eid = ANY(sp.event_ids))', { eid: eventId });
    }
    if (communityId) {
      qb.andWhere('(sp.community_ids IS NULL OR :cid = ANY(sp.community_ids))', { cid: communityId });
    }

    return qb.orderBy('sp.priority_score', 'DESC').take(5).getMany();
  }

  async recordImpression(placementId: string): Promise<void> {
    await this.placementRepo.increment({ placement_id: placementId }, 'impression_count', 1);
  }

  async recordClick(placementId: string): Promise<void> {
    await this.placementRepo.increment({ placement_id: placementId }, 'click_count', 1);
  }
}