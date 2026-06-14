import { PrismaClient, Prisma } from '@prisma/client';
import {
  Route,
  RouteTip,
  TravelGroup,
  TravelGroupMember,
  BorderVisaInfo,
  RouteMatch,
  RouteSearchParams,
  TravelGroupSearchParams,
  CreateTravelGroupBody,
  UpdateTravelGroupBody,
  CreateRouteTipBody,
  PaginatedResponse,
} from '@roarpass/shared';

export class IntercityCoordinationRepository {
  constructor(private readonly db: PrismaClient) {}

  // ── Routes ──────────────────────────────────────────────────

  async findRoutes(params: RouteSearchParams): Promise<PaginatedResponse<Route>> {
    const { event_id, origin_city_id, destination_city_id, transport_mode, is_international, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RouteWhereInput = {
      is_active: true,
      ...(event_id && { event_id }),
      ...(origin_city_id && { origin_city_id }),
      ...(destination_city_id && { destination_city_id }),
      ...(typeof is_international === 'boolean' && { is_international }),
      ...(transport_mode && {
        transport_modes: { has: transport_mode },
      }),
    };

    const [rows, total] = await Promise.all([
      this.db.route.findMany({ where, skip, take: limit, orderBy: { fan_traveler_count: 'desc' } }),
      this.db.route.count({ where }),
    ]);

    return { data: rows as unknown as Route[], page, limit, total, has_more: skip + rows.length < total };
  }

  async findRouteById(route_id: string): Promise<Route | null> {
    const row = await this.db.route.findUnique({ where: { route_id } });
    return row as unknown as Route | null;
  }

  // ── Route Tips ───────────────────────────────────────────────

  async findTipsByRoute(
    route_id: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<RouteTip>> {
    const skip = (page - 1) * limit;
    const where: Prisma.RouteTipWhereInput = { route_id, is_moderated: false };

    const [rows, total] = await Promise.all([
      this.db.routeTip.findMany({ where, skip, take: limit, orderBy: { upvotes: 'desc' } }),
      this.db.routeTip.count({ where }),
    ]);

    return { data: rows as unknown as RouteTip[], page, limit, total, has_more: skip + rows.length < total };
  }

  async createTip(route_id: string, author_user_id: string, authorData: { display_name: string; trust_tier: string }, body: CreateRouteTipBody): Promise<RouteTip> {
    const row = await this.db.routeTip.create({
      data: {
        route_id,
        author_user_id,
        author_display_name: authorData.display_name,
        author_trust_tier: authorData.trust_tier,
        category: body.category,
        content: body.content,
      },
    });
    return row as unknown as RouteTip;
  }

  async upvoteTip(tip_id: string, user_id: string): Promise<RouteTip> {
    // idempotent: upsert a vote record then recount
    await this.db.routeTipVote.upsert({
      where: { tip_id_user_id: { tip_id, user_id } },
      create: { tip_id, user_id },
      update: {},
    });
    const count = await this.db.routeTipVote.count({ where: { tip_id } });
    const row = await this.db.routeTip.update({ where: { tip_id }, data: { upvotes: count } });
    return row as unknown as RouteTip;
  }

  async deleteTip(tip_id: string, user_id: string): Promise<boolean> {
    const tip = await this.db.routeTip.findUnique({ where: { tip_id } });
    if (!tip || tip.author_user_id !== user_id) return false;
    await this.db.routeTip.delete({ where: { tip_id } });
    return true;
  }

  // ── Travel Groups ────────────────────────────────────────────

  async findTravelGroups(params: TravelGroupSearchParams): Promise<PaginatedResponse<TravelGroup>> {
    const { route_id, event_id, travel_date, transport_mode, status, has_availability, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TravelGroupWhereInput = {
      ...(route_id && { route_id }),
      ...(event_id && { event_id }),
      ...(transport_mode && { transport_mode }),
      ...(status && { status }),
      ...(travel_date && {
        departure_datetime: {
          gte: new Date(`${travel_date}T00:00:00.000Z`),
          lte: new Date(`${travel_date}T23:59:59.999Z`),
        },
      }),
      ...(has_availability && {
        AND: [{ status: 'OPEN' }],
        // current_member_count < max_members evaluated post-query if DB doesn't support column comparison natively
      }),
    };

    const [rows, total] = await Promise.all([
      this.db.travelGroup.findMany({ where, skip, take: limit, orderBy: { departure_datetime: 'asc' } }),
      this.db.travelGroup.count({ where }),
    ]);

    const filtered = has_availability
      ? rows.filter((r) => r.current_member_count < r.max_members)
      : rows;

    return { data: filtered as unknown as TravelGroup[], page, limit, total, has_more: skip + rows.length < total };
  }

  async findTravelGroupById(group_id: string): Promise<TravelGroup | null> {
    const row = await this.db.travelGroup.findUnique({ where: { group_id } });
    return row as unknown as TravelGroup | null;
  }

  async createTravelGroup(organizer_user_id: string, organizerName: string, body: CreateTravelGroupBody): Promise<TravelGroup> {
    const row = await this.db.travelGroup.create({
      data: {
        ...body,
        organizer_user_id,
        organizer_display_name: organizerName,
        status: 'OPEN',
        current_member_count: 1,
        members: {
          create: {
            user_id: organizer_user_id,
            display_name: organizerName,
            trust_tier: 'STANDARD',
            role: 'ORGANIZER',
          },
        },
      },
    });
    return row as unknown as TravelGroup;
  }

  async updateTravelGroup(group_id: string, user_id: string, body: UpdateTravelGroupBody): Promise<TravelGroup | null> {
    const group = await this.db.travelGroup.findUnique({ where: { group_id } });
    if (!group || group.organizer_user_id !== user_id) return null;

    const row = await this.db.travelGroup.update({ where: { group_id }, data: body });
    return row as unknown as TravelGroup;
  }

  async joinTravelGroup(group_id: string, user_id: string, displayName: string, trustTier: string): Promise<{ success: boolean; reason?: string }> {
    const group = await this.db.travelGroup.findUnique({ where: { group_id } });
    if (!group) return { success: false, reason: 'NOT_FOUND' };
    if (group.status !== 'OPEN') return { success: false, reason: 'GROUP_NOT_OPEN' };
    if (group.current_member_count >= group.max_members) return { success: false, reason: 'GROUP_FULL' };

    const existing = await this.db.travelGroupMember.findFirst({ where: { group_id, user_id } });
    if (existing) return { success: false, reason: 'ALREADY_MEMBER' };

    await this.db.$transaction([
      this.db.travelGroupMember.create({
        data: { group_id, user_id, display_name: displayName, trust_tier: trustTier, role: 'MEMBER' },
      }),
      this.db.travelGroup.update({
        where: { group_id },
        data: { current_member_count: { increment: 1 } },
      }),
    ]);

    return { success: true };
  }

  async leaveTravelGroup(group_id: string, user_id: string): Promise<{ success: boolean; reason?: string }> {
    const membership = await this.db.travelGroupMember.findFirst({ where: { group_id, user_id } });
    if (!membership) return { success: false, reason: 'NOT_MEMBER' };

    const group = await this.db.travelGroup.findUnique({ where: { group_id } });
    if (group?.organizer_user_id === user_id) return { success: false, reason: 'ORGANIZER_CANNOT_LEAVE' };

    await this.db.$transaction([
      this.db.travelGroupMember.delete({ where: { membership_id: membership.membership_id } }),
      this.db.travelGroup.update({
        where: { group_id },
        data: { current_member_count: { decrement: 1 } },
      }),
    ]);

    return { success: true };
  }

  async findGroupMembers(group_id: string): Promise<TravelGroupMember[]> {
    const rows = await this.db.travelGroupMember.findMany({ where: { group_id } });
    return rows as unknown as TravelGroupMember[];
  }

  // ── Border/Visa Info ─────────────────────────────────────────

  async findBorderInfo(route_id: string, nationality_code?: string): Promise<BorderVisaInfo[]> {
    const rows = await this.db.borderVisaInfo.findMany({
      where: {
        route_id,
        is_active: true,
        OR: [
          { nationality_code: null },
          ...(nationality_code ? [{ nationality_code }] : []),
        ],
      },
      orderBy: { last_verified_at: 'desc' },
    });
    return rows as unknown as BorderVisaInfo[];
  }

  // ── Fan Route Matches ────────────────────────────────────────

  async findFanMatches(route_id: string, travel_date: string, exclude_user_id: string): Promise<RouteMatch[]> {
    // Query users who have itinerary items or expressed interest in this route on this date
    const rows = await this.db.routeFanInterest.findMany({
      where: {
        route_id,
        travel_date,
        user_id: { not: exclude_user_id },
      },
      include: {
        user: {
          select: {
            user_id: true,
            display_name: true,
            trust_tier: true,
            country_flag: true,
          },
        },
      },
      take: 20,
    });

    return rows.map((r) => ({
      user_id: r.user_id,
      display_name: r.user.display_name,
      trust_tier: r.user.trust_tier,
      country_flag: r.user.country_flag ?? null,
      travel_date: r.travel_date,
      transport_mode_preference: (r.transport_mode_preference as any) ?? null,
    }));
  }

  async expressRouteInterest(route_id: string, user_id: string, travel_date: string, transport_mode_preference?: string): Promise<void> {
    await this.db.routeFanInterest.upsert({
      where: { route_id_user_id_travel_date: { route_id, user_id, travel_date } },
      create: { route_id, user_id, travel_date, transport_mode_preference: transport_mode_preference ?? null },
      update: { transport_mode_preference: transport_mode_preference ?? null },
    });
  }
}