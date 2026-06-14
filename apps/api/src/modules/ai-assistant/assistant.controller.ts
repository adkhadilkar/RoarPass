import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Headers,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from './guards/premium.guard';
import { AssistantRateLimitGuard } from './guards/rate-limit.guard';
import { AssistantService } from './assistant.service';
import {
  CreateSessionRequestSchema,
  SendTurnRequestSchema,
  SubmitFeedbackRequestSchema,
} from '@roarpass/shared';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';

@Controller('v1/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  // ── GET /v1/assistant/status ──────────────────────────────────────────────
  @Get('status')
  async getStatus(@Req() req: Request) {
    return this.assistantService.getStatus(req.user.sub);
  }

  // ── POST /v1/assistant/sessions ───────────────────────────────────────────
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateSessionRequestSchema)) body: any,
  ) {
    return this.assistantService.createOrResumeSession(req.user.sub, body);
  }

  // ── POST /v1/assistant/sessions/:id/turns ─────────────────────────────────
  @Post('sessions/:session_id/turns')
  @UseGuards(AssistantRateLimitGuard)
  async sendTurn(
    @Req() req: Request,
    @Res() res: Response,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(SendTurnRequestSchema)) body: any,
    @Headers('accept') accept: string,
  ) {
    // Enforce session ownership
    await this.assistantService.assertSessionOwner(sessionId, req.user.sub);

    const streaming = accept?.includes('text/event-stream');

    if (streaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await this.assistantService.streamTurn(
        req.user.sub,
        sessionId,
        body,
        res,
      );
    } else {
      const result = await this.assistantService.processTurn(
        req.user.sub,
        sessionId,
        body,
      );
      res.json(result);
    }
  }

  // ── GET /v1/assistant/sessions/:id/turns ──────────────────────────────────
  @Get('sessions/:session_id/turns')
  async getSessionHistory(
    @Req() req: Request,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('before_sequence', new DefaultValuePipe(0), ParseIntPipe)
    beforeSequence: number,
  ) {
    await this.assistantService.assertSessionOwner(sessionId, req.user.sub);
    return this.assistantService.getSessionHistory(
      sessionId,
      Math.min(limit, 50),
      beforeSequence,
    );
  }

  // ── POST /v1/assistant/turns/:id/feedback ─────────────────────────────────
  @Post('turns/:turn_id/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Req() req: Request,
    @Param('turn_id', ParseUUIDPipe) turnId: string,
    @Body(new ZodValidationPipe(SubmitFeedbackRequestSchema)) body: any,
  ) {
    await this.assistantService.assertTurnAccessible(turnId, req.user.sub);
    return this.assistantService.submitFeedback(turnId, body);
  }

  // ── DELETE /v1/assistant/sessions/:id ────────────────────────────────────
  @Delete('sessions/:session_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearSession(
    @Req() req: Request,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
  ) {
    await this.assistantService.assertSessionOwner(sessionId, req.user.sub);
    await this.assistantService.clearSession(sessionId, req.user.sub);
  }
}