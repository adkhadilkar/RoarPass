import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ChannelService } from '../services/channel.service';
import {
  CreateDirectMessageChannelRequest,
  CreateGroupChatRequest,
  UpdateMembershipRequest,
  UpdateParticipantRoleRequest,
  ChannelType,
} from '@roarpass/shared';
import { CreateDMSchema, CreateGroupChatSchema } from '@roarpass/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('v1/messaging/channels')
@UseGuards(JwtAuthGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  /** List channels the current user belongs to */
  @Get()
  async listMyChannels(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: ChannelType,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.channelService.listUserChannels(user.id, { type, cursor, limit: Math.min(limit, 100) });
  }

  /** Get a single channel */
  @Get(':channelId')
  async getChannel(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ) {
    return this.channelService.getChannelForUser(channelId, user.id);
  }

  /** Start or retrieve a 1:1 DM */
  @Post('direct')
  @HttpCode(HttpStatus.CREATED)
  async createDM(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateDMSchema)) dto: CreateDirectMessageChannelRequest,
  ) {
    return this.channelService.createOrGetDMChannel(user.id, dto.recipientUserId);
  }

  /** Create group chat */
  @Post('group')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateGroupChatSchema)) dto: CreateGroupChatRequest,
  ) {
    return this.channelService.createGroupChat(user.id, dto);
  }

  /** Leave a channel */
  @Delete(':channelId/membership')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveChannel(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ) {
    await this.channelService.leaveChannel(channelId, user.id);
  }

  /** Update own membership settings (mute, notifications) */
  @Patch(':channelId/membership')
  async updateMembership(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: UpdateMembershipRequest,
  ) {
    return this.channelService.updateMembership(channelId, user.id, dto);
  }

  /** List participants */
  @Get(':channelId/participants')
  async listParticipants(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.channelService.listParticipants(channelId, user.id, { cursor, limit: Math.min(limit, 200) });
  }

  /** Add participant (admin/owner only) */
  @Post(':channelId/participants/:userId')
  @HttpCode(HttpStatus.CREATED)
  async addParticipant(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.channelService.addParticipant(channelId, userId, user.id);
  }

  /** Update participant role (admin/owner only) */
  @Patch(':channelId/participants/:userId/role')
  async updateParticipantRole(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateParticipantRoleRequest,
  ) {
    return this.channelService.updateParticipantRole(channelId, userId, user.id, dto.role);
  }

  /** Remove participant (admin/owner only) */
  @Delete(':channelId/participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.channelService.removeParticipant(channelId, userId, user.id);
  }
}