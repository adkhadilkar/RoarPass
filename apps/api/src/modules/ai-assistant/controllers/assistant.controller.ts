import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ThrottlerGuard } from '../guards/assistant-throttler.guard';
import { ConsentGuard } from '../guards/consent.guard';
import { PremiumOrTrialGuard } from '../guards/premium-or-trial.guard';

import { AssistantSessionService } from '../services/assistant-session.service';
import { AssistantTurnService } from '../services/assistant-turn.service';
import { ConsentService } from '../services/consent.service';

import {
  StartSessionDto,
  SendTurnDto,
  SubmitFeedbackDto,
  GetSessionHistoryQueryDto,
  ConsentDto,
} from '../dto/assistant.dto';
import {
  StartSessionResponse,
  AssistantStatusResponse,
  SubmitFeedbackResponse,
  GetSessionHistoryResponse,
} from '@roarpass/shared';

@Controller('v1/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(
    private readonly sessionService: AssistantSessionService,
    private readonly turnService: AssistantTurnService,
    private readonly consentService: ConsentService,
  ) {}

  // ─────────────────────────────────────────────
  // GET /v1/assistant/status  — REQ-AI-29, REQ-AI-30, REQ-AI-31
  // ─────────────────────────────────────────────
  @Get('status')
  async getStatus(@Request() req: AuthenticatedRequest): Promise<AssistantStatusResponse> {
    return this.sessionService.getAssistantStatus(req.user.user_id);
  }

  // ─────────────────────────────────────────────
  // POST /v1/assistant/consent  — REQ-AI-NFR-05
  // ─────────────────────────────────────────────
  @Post('consent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async grantConsent(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ConsentDto,
  ): Promise<void> {
    await this.consentService.upsertConsent(req.user.user_id, dto);
  }

  @Get('consent')
  async getConsent(@Request() req: AuthenticatedRequest) {
    return this.consentService.getConsent(req.user.user_id);
  }

  // ─────────────────────────────────────────────
  // POST /v1/assistant/sessions  — REQ-AI-01, REQ-AI-29–31
  // ─────────────────────────────────────────────
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ConsentGuard)
  async startSession(
    @Request() req: AuthenticatedRequest,
    @Body() dto: StartSessionDto,
  ): Promise<StartSessionResponse> {
    return this.sessionService.startOrResumeSession(req.user.user_id, dto);
  }

  // ─────────────────────────────────────────────
  // POST /v1/assistant/sessions/:sessionId/turns  — REQ-AI-02, streaming REQ-AI-NFR-03
  // Rate-limited at API gateway layer (REQ-AI-NFR-19), also enforced here (REQ-AI-28)
  // ─────────────────────────────────────────────
  @Post('sessions/:sessionId/turns/stream')
  @UseGuards(ConsentGuard, PremiumOrTrialGuard, ThrottlerGuard)
  @Sse()
  async sendTurnStream(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SendTurnDto,
  ): Promise<Observable<MessageEvent>> {
    return this.turnService.sendTurnStreaming(req.user.user_id, sessionId, dto);
  }

  @Post('sessions/:sessionId/turns')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ConsentGuard, PremiumOrTrialGuard, ThrottlerGuard)
  async sendTurn(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SendTurnDto,
  ) {
    return this.turnService.sendTurn(req.user.user_id, sessionId, dto);
  }

  // ─────────────────────────────────────────────
  // GET /v1/assistant/sessions/:sessionId/turns
  // ─────────────────────────────────────────────
  @Get('sessions/:sessionId/turns')
  async getSessionHistory(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query() query: GetSessionHistoryQueryDto,
  ): Promise<GetSessionHistoryResponse> {
    return this.sessionService.getSessionHistory(
      req.user.user_id,
      sessionId,
      query,
    );
  }

  // ─────────────────────────────────────────────
  // DELETE /v1/assistant/sessions/:sessionId  — REQ-AI-06 (clear session control)
  // ─────────────────────────────────────────────
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearSession(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.sessionService.clearSession(req.user.user_id, sessionId);
  }

  // ─────────────────────────────────────────────
  // POST /v1/assistant/turns/:turnId/feedback  — REQ-AI-32, REQ-AI-33
  // ─────────────────────────────────────────────
  @Post('turns/:turnId/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Request() req: AuthenticatedRequest,
    @Param('turnId', ParseUUIDPipe) turnId: string,
    @Body() dto: SubmitFeedbackDto,
  ): Promise<SubmitFeedbackResponse> {
    return this.turnService.submitFeedback(req.user.user_id, turnId, dto);
  }
}

interface AuthenticatedRequest extends Request {
  user: { user_id: string; subscription_tier: string };
}