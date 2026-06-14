import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IntercityCoordinationService } from './intercity-coordination.service';
import {
  TravelGroupCreateSchema,
  TravelGroupUpdateSchema,
  RouteTipCreateSchema,
  RouteTipUpdateSchema,
  ListRoutesQuery,
  ListTravelGroupsQuery,
  TransportMode,
  RouteGroupStatus,
  TipCategory,
} from '@roarpass/shared';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../auth/types';

// ─── Query validation schemas ─────────────────────────────────────────────────

const ListRoutesQuerySchema = z.object({
  event_id: z.string().uuid(),
  origin_city_id: z.string().uuid().optional(),
  destination_city_id: z.string().uuid().optional(),
  transport_mode: z.nativeEnum(TransportMode).optional(),
  is_cross_border: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

const ListGroupsQuerySchema = z.object({
  route_id: z.string().uuid(),
  departure_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.nativeEnum(RouteGroupStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

const ListTipsQuerySchema = z.object({
  category: z.nativeEnum(TipCategory).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('v1/intercity')
@UseGuards(JwtAuthGuard)
export class IntercityCoordinationController {
  constructor(private readonly svc: IntercityCoordinationService) {}

  // ── Routes ──────────────────────────────────────────────────────────────────

  @Get('routes')
  async listRoutes(
    @Query(new ZodValidationPipe(ListRoutesQuerySchema)) query: ListRoutesQuery
  ) {
    return this.svc.listRoutes(query);
  }

  @Get('routes/:route_id')
  async getRoute(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.getRouteWithDetails(routeId, req.user.nationality_code);
  }

  // ── Route Tips ───────────────────────────────────────────────────────────────

  @Get('routes/:route_id/tips')
  async listTips(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Query(new ZodValidationPipe(ListTipsQuerySchema)) query: z.infer<typeof ListTipsQuerySchema>
  ) {
    return this.svc.listTips(routeId, query);
  }

  @Post('routes/:route_id/tips')
  @HttpCode(HttpStatus.CREATED)
  async createTip(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Body(new ZodValidationPipe(RouteTipCreateSchema.omit({ route_id: true })))
    body: Omit<z.infer<typeof RouteTipCreateSchema>, 'route_id'>,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.createTip(
      { ...body, route_id: routeId },
      req.user
    );
  }

  @Patch('tips/:tip_id')
  async updateTip(
    @Param('tip_id', ParseUUIDPipe) tipId: string,
    @Body(new ZodValidationPipe(RouteTipUpdateSchema)) body: z.infer<typeof RouteTipUpdateSchema>,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.updateTip(tipId, body, req.user);
  }

  @Delete('tips/:tip_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTip(
    @Param('tip_id', ParseUUIDPipe) tipId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.deleteTip(tipId, req.user);
  }

  @Post('tips/:tip_id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async voteTip(
    @Param('tip_id', ParseUUIDPipe) tipId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.voteTip(tipId, req.user.user_id);
  }

  // ── Travel Groups ────────────────────────────────────────────────────────────

  @Get('groups')
  async listGroups(
    @Query(new ZodValidationPipe(ListGroupsQuerySchema)) query: z.infer<typeof ListGroupsQuerySchema>
  ) {
    return this.svc.listGroups(query);
  }

  @Post('groups')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @Body(new ZodValidationPipe(TravelGroupCreateSchema)) body: z.infer<typeof TravelGroupCreateSchema>,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.createGroup(body, req.user);
  }

  @Get('groups/:group_id')
  async getGroup(@Param('group_id', ParseUUIDPipe) groupId: string) {
    return this.svc.getGroup(groupId);
  }

  @Patch('groups/:group_id')
  async updateGroup(
    @Param('group_id', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(TravelGroupUpdateSchema)) body: z.infer<typeof TravelGroupUpdateSchema>,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.updateGroup(groupId, body, req.user);
  }

  @Post('groups/:group_id/join')
  @HttpCode(HttpStatus.CREATED)
  async joinGroup(
    @Param('group_id', ParseUUIDPipe) groupId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.joinGroup(groupId, req.user);
  }

  @Delete('groups/:group_id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveGroup(
    @Param('group_id', ParseUUIDPipe) groupId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.leaveGroup(groupId, req.user.user_id);
  }

  @Delete('groups/:group_id/members/:user_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('group_id', ParseUUIDPipe) groupId: string,
    @Param('user_id', ParseUUIDPipe) userId: string,
    @Req() req: AuthenticatedRequest
  ) {
    // Only organizer can remove others
    await this.svc.removeMember(groupId, userId, req.user.user_id);
  }

  // ── Visa / Border Alerts ─────────────────────────────────────────────────────

  @Get('routes/:route_id/visa-alerts')
  async getVisaAlerts(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.getVisaAlerts(routeId, req.user.nationality_code);
  }

  // ── Co-Traveler Signals ──────────────────────────────────────────────────────

  @Get('routes/:route_id/co-travelers')
  async getCoTravelerSignal(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Query('departure_date') departureDate: string
  ) {
    const parsed = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(departureDate);
    return this.svc.getCoTravelerSignal(routeId, parsed);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post('admin/routes')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'EVENT_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  async adminCreateRoute(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest
  ) {
    // Full route creation is admin-only
    return this.svc.adminCreateRoute(body, req.user.user_id);
  }

  @Patch('admin/routes/:route_id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'EVENT_MANAGER')
  async adminUpdateRoute(
    @Param('route_id', ParseUUIDPipe) routeId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.adminUpdateRoute(routeId, body, req.user.user_id);
  }

  @Patch('admin/tips/:tip_id/verify')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOCAL_HELPER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminVerifyTip(
    @Param('tip_id', ParseUUIDPipe) tipId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.verifyTip(tipId, req.user.user_id);
  }

  @Patch('admin/tips/:tip_id/flag')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminFlagTip(
    @Param('tip_id', ParseUUIDPipe) tipId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.flagTip(tipId, req.user.user_id);
  }

  @Post('admin/visa-alerts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async adminCreateVisaAlert(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.createVisaAlert(body, req.user.user_id);
  }
}