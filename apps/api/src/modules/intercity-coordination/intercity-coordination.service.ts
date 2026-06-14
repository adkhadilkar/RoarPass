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
import { IntercityCoordinationRepository } from './intercity-coordination.repository';

export class IntercityCoordinationService {
  constructor(private readonly repo: IntercityCoordinationRepository) {}

  // ── Routes ──────────────────────────────────────────────────

  async getRoutes(params: RouteSearchParams): Promise<PaginatedResponse<Route>> {
    return this.repo.findRoutes(params);
  }

  async getRouteById(route_id: string): Promise<Route | null> {
    return this.repo.findRouteById(route_id);
  }

  // ── Route Tips ───────────────────────────────────────────────

  async getRouteTips(route_id: string, page: number, limit: number): Promise<PaginatedResponse<RouteTip>> {
    return this.repo.findTipsByRoute(route_id, page, limit);
  }

  async createRouteTip(
    route_id: string,
    author: { user_id: string; display_name: string; trust_tier: string },
    body: CreateRouteTipBody,
  ): Promise<RouteTip> {
    const route = await this.repo.findRouteById(route_id);
    if (!route) throw new ServiceError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    return this.repo.createTip(route_id, author.user_id, { display_name: author.display_name, trust_tier: author.trust_tier }, body);
  }

  async upvoteRouteTip(tip_id: string, user_id: string): Promise<RouteTip> {
    return this.repo.upvoteTip(tip_id, user_id);
  }

  async deleteRouteTip(tip_id: string, user_id: string): Promise<void> {
    const deleted = await this.repo.deleteTip(tip_id, user_id);
    if (!deleted) throw new ServiceError(403, 'FORBIDDEN', 'Cannot delete this tip');
  }

  // ── Travel Groups ────────────────────────────────────────────

  async getTravelGroups(params: TravelGroupSearchParams): Promise<PaginatedResponse<TravelGroup>> {
    return this.repo.findTravelGroups(params);
  }

  async getTravelGroupById(group_id: string): Promise<TravelGroup | null> {
    return this.repo.findTravelGroupById(group_id);
  }

  async createTravelGroup(
    organizer: { user_id: string; display_name: string },
    body: CreateTravelGroupBody,
  ): Promise<TravelGroup> {
    const route = await this.repo.findRouteById(body.route_id);
    if (!route) throw new ServiceError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    return this.repo.createTravelGroup(organizer.user_id, organizer.display_name, body);
  }

  async updateTravelGroup(
    group_id: string,
    user_id: string,
    body: UpdateTravelGroupBody,
  ): Promise<TravelGroup> {
    const updated = await this.repo.updateTravelGroup(group_id, user_id, body);
    if (!updated) throw new ServiceError(403, 'FORBIDDEN', 'You do not own this group');
    return updated;
  }

  async joinTravelGroup(
    group_id: string,
    user: { user_id: string; display_name: string; trust_tier: string },
  ): Promise<void> {
    const result = await this.repo.joinTravelGroup(group_id, user.user_id, user.display_name, user.trust_tier);
    if (!result.success) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        GROUP_NOT_OPEN: 409,
        GROUP_FULL: 409,
        ALREADY_MEMBER: 409,
      };
      throw new ServiceError(statusMap[result.reason!] ?? 400, result.reason!, result.reason!);
    }
  }

  async leaveTravelGroup(group_id: string, user_id: string): Promise<void> {
    const result = await this.repo.leaveTravelGroup(group_id, user_id);
    if (!result.success) {
      throw new ServiceError(result.reason === 'NOT_MEMBER' ? 404 : 400, result.reason!, result.reason!);
    }
  }

  async getGroupMembers(group_id: string): Promise<TravelGroupMember[]> {
    return this.repo.findGroupMembers(group_id);
  }

  // ── Border / Visa ────────────────────────────────────────────

  async getBorderVisaInfo(route_id: string, nationality_code?: string): Promise<BorderVisaInfo[]> {
    const route = await this.repo.findRouteById(route_id);
    if (!route) throw new ServiceError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    return this.repo.findBorderInfo(route_id, nationality_code);
  }

  // ── Fan Matching ─────────────────────────────────────────────

  async getFanMatches(route_id: string, travel_date: string, current_user_id: string): Promise<RouteMatch[]> {
    return this.repo.findFanMatches(route_id, travel_date, current_user_id);
  }

  async expressInterest(
    route_id: string,
    user_id: string,
    travel_date: string,
    transport_mode_preference?: string,
  ): Promise<void> {
    const route = await this.repo.findRouteById(route_id);
    if (!route) throw new ServiceError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    await this.repo.expressRouteInterest(route_id, user_id, travel_date, transport_mode_preference);
  }
}

export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}