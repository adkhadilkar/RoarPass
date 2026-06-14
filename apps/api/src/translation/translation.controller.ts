import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  TranslateMessageRequestSchema,
  UpdateTranslationPreferenceSchema,
  PhraseCardQuerySchema,
  PhraseCategory,
} from '@roarpass/shared/translation';
import { TranslationService, TranslationError } from './translation.service';
import { PhraseCardService } from './phrase-card.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';

interface AuthenticatedRequest extends Request {
  user: { userId: string; roles: string[] };
}

@Controller('v1/translation')
export class TranslationController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly phraseCardService: PhraseCardService,
  ) {}

  // ─── User preferences ────────────────────────────────────────────────────

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@Req() req: AuthenticatedRequest) {
    return this.translationService.getUserPreference(req.user.userId);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateTranslationPreferenceSchema)) body: z.infer<typeof UpdateTranslationPreferenceSchema>,
  ) {
    return this.translationService.updateUserPreference(req.user.userId, body);
  }

  // ─── On-demand translation ────────────────────────────────────────────────

  @Post('messages/:messageId/translate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100/min per user (REQ security §7.6)
  @HttpCode(HttpStatus.OK)
  async translateMessage(
    @Req() req: AuthenticatedRequest,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body(new ZodValidationPipe(TranslateMessageRequestSchema)) body: z.infer<typeof TranslateMessageRequestSchema>,
  ) {
    const pref = await this.translationService.getUserPreference(req.user.userId);
    const targetLanguage = body.target_language ?? pref.preferred_language;

    try {
      return await this.translationService.translateMessage(messageId, targetLanguage, req.user.userId);
    } catch (err) {
      if (err instanceof TranslationError) {
        throw err; // Let NestJS exception filter handle
      }
      throw err;
    }
  }

  // ─── Phrase cards (public, cacheable) ────────────────────────────────────

  @Get('phrase-cards')
  async getPhraseCards(
    @Query(new ZodValidationPipe(PhraseCardQuerySchema)) query: z.infer<typeof PhraseCardQuerySchema>,
  ) {
    // Cache-Control header is set by the phrase card service response interceptor
    return this.phraseCardService.getPhraseCards(
      query.target_language,
      query.category as PhraseCategory | undefined,
      query.event_id,
    );
  }

  // ─── Internal detect-language (NOT exposed publicly) ─────────────────────

  @Post('internal/detect-language')
  @UseGuards(InternalServiceGuard) // mTLS / service-mesh auth only
  @HttpCode(HttpStatus.OK)
  async detectLanguage(
    @Body() body: { message_id: string; text: string },
  ) {
    return this.translationService.detectLanguage(body.message_id, body.text);
  }
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TranslationAdminController {
  constructor(private readonly phraseCardService: PhraseCardService) {}

  @Get('phrase-cards')
  async listPhraseCards(
    @Query('category') category?: string,
    @Query('target_language') targetLanguage?: string,
    @Query('is_active') isActive?: string,
  ) {
    return this.phraseCardService.adminListPhraseCards(
      category as PhraseCategory | undefined,
      targetLanguage,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Post('phrase-cards')
  @HttpCode(HttpStatus.CREATED)
  async createPhraseCard(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.phraseCardService.adminCreatePhraseCard(body, req.user.userId);
  }

  @Put('phrase-cards/:phraseId')
  async updatePhraseCard(
    @Param('phraseId', ParseUUIDPipe) phraseId: string,
    @Body() body: unknown,
  ) {
    return this.phraseCardService.adminUpdatePhraseCard(phraseId, body);
  }

  @Delete('phrase-cards/:phraseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhraseCard(@Param('phraseId', ParseUUIDPipe) phraseId: string) {
    return this.phraseCardService.adminDeletePhraseCard(phraseId);
  }

  @Get('events/:eventId/host-language-mappings')
  async getHostLanguageMappings(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.phraseCardService.getHostLanguageMappings(eventId);
  }

  @Put('events/:eventId/host-cities/:hostCityId/languages')
  async updateHostCityLanguages(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('hostCityId', ParseUUIDPipe) hostCityId: string,
    @Body() body: { primary_languages: string[]; phrase_cards_ready: boolean },
  ) {
    return this.phraseCardService.upsertHostLanguageMapping(eventId, hostCityId, body);
  }
}