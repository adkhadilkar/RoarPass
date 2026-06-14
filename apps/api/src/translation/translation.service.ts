import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DetectLanguageRequest,
  DetectLanguageResponse,
  TranslateMessageResponse,
  TranslationProvider,
  TRANSLATION_ERRORS,
  isRTL,
} from '@roarpass/shared';
import { TranslationProviderFactory } from './providers/translation-provider.factory';
import { TranslationCacheService } from './translation-cache.service';
import { TranslationRepository } from './translation.repository';
import { UserTranslationPreferenceRepository } from './user-translation-preference.repository';
import { MessageMetaRepository } from './message-meta.repository';

const MAX_TEXT_LENGTH = 5000;
const MIN_CONFIDENCE_SHOW_AFFORDANCE = 0.5;

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly providerFactory: TranslationProviderFactory,
    private readonly cache: TranslationCacheService,
    private readonly translationRepo: TranslationRepository,
    private readonly prefRepo: UserTranslationPreferenceRepository,
    private readonly messageMetaRepo: MessageMetaRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Asynchronous language detection — called after message storage.
   * Must not block message delivery.
   */
  async detectLanguage(req: DetectLanguageRequest): Promise<DetectLanguageResponse> {
    // Pseudonymise: strip message_id from payload sent to provider
    const textPayload = req.text.substring(0, MAX_TEXT_LENGTH);
    const provider = this.providerFactory.getPrimary();
    const result = await provider.detectLanguage(textPayload);

    // Persist metadata back to messaging service data store
    await this.messageMetaRepo.upsert({
      message_id: req.message_id,
      detected_language: result.detected_language,
      detection_confidence: result.confidence,
      is_official: false, // default; messaging service sets true for official messages
      detected_at: new Date().toISOString(),
    });

    return result;
  }

  /**
   * On-demand message translation with cache, skip-logic, and fallback provider.
   */
  async translateMessage(
    messageId: string,
    requestedTargetLang: string | undefined,
    userId: string,
  ): Promise<TranslateMessageResponse> {
    // 1. Load message metadata
    const meta = await this.messageMetaRepo.findByMessageId(messageId);
    if (!meta) {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    // 2. Official messages — translation suppressed (REQ-TRANS-06, AC-TRANS-10)
    if (meta.is_official) {
      throw Object.assign(new Error(TRANSLATION_ERRORS.SUPPRESSED_OFFICIAL), {
        code: TRANSLATION_ERRORS.SUPPRESSED_OFFICIAL,
      });
    }

    // 3. Resolve target language
    const pref = await this.prefRepo.findByUserId(userId);
    const targetLang = requestedTargetLang ?? pref?.preferred_language ?? 'en';

    // 4. Same language shortcut (EC-3)
    if (meta.detected_language === targetLang) {
      return {
        message_id: messageId,
        source_language: meta.detected_language,
        target_language: targetLang,
        translated_text: '', // caller should use original text
        provider: 'DEEPL',
        provider_attribution: '',
        from_cache: false,
        detection_confidence: meta.detection_confidence,
        is_partial: false,
      };
    }

    // 5. Cache lookup (REQ-TRANS-07)
    const cached = await this.cache.get(messageId, targetLang);
    if (cached) {
      return {
        message_id: messageId,
        source_language: meta.detected_language,
        target_language: targetLang,
        translated_text: cached.translated_text,
        provider: cached.provider,
        provider_attribution: cached.provider_attribution,
        from_cache: true,
        detection_confidence: meta.detection_confidence,
        is_partial: false,
      };
    }

    // 6. Fetch original message text (from messaging service)
    const messageText = await this.messageMetaRepo.getMessageText(messageId);
    if (!messageText) {
      throw new Error('MESSAGE_TEXT_NOT_FOUND');
    }

    // 7. Truncate long messages (EC-8)
    const isPartial = messageText.length > MAX_TEXT_LENGTH;
    const textToTranslate = isPartial ? messageText.substring(0, MAX_TEXT_LENGTH) : messageText;

    // 8. Call provider with failover
    const { translatedText, provider, attribution } = await this.callProviderWithFallback(
      textToTranslate,
      meta.detected_language,
      targetLang,
    );

    // 9. Validate result (EC-9)
    if (!translatedText || translatedText.trim().length === 0) {
      throw Object.assign(new Error(TRANSLATION_ERRORS.EMPTY_RESULT), {
        code: TRANSLATION_ERRORS.EMPTY_RESULT,
      });
    }

    // 10. Store in cache (REQ-TRANS-07)
    await this.cache.set(messageId, targetLang, translatedText, provider, attribution);

    return {
      message_id: messageId,
      source_language: meta.detected_language,
      target_language: targetLang,
      translated_text: translatedText,
      provider,
      provider_attribution: attribution,
      from_cache: false,
      detection_confidence: meta.detection_confidence,
      is_partial: isPartial,
    };
  }

  /**
   * Determine whether a translation affordance should be shown to the user.
   * Called client-side via metadata endpoint; separated for testability.
   */
  shouldShowTranslateAffordance(
    detectedLang: string,
    confidence: number,
    userPreferredLang: string,
    userLanguagesSpoken: string[],
    isOfficial: boolean,
  ): { show: boolean; autoTranslate: boolean; reason: string } {
    // Official messages — never show affordance (REQ-TRANS-06, EC-11)
    if (isOfficial) {
      return { show: false, autoTranslate: false, reason: 'official_message' };
    }

    // Skip if user speaks the detected language (REQ-TRANS-05, AC-TRANS-03)
    if (userLanguagesSpoken.includes(detectedLang)) {
      return { show: false, autoTranslate: false, reason: 'user_speaks_language' };
    }

    // Same language as preference
    if (detectedLang === userPreferredLang) {
      return { show: false, autoTranslate: false, reason: 'same_as_preferred' };
    }

    // Very low confidence — do not show affordance (EC-2)
    if (confidence < MIN_CONFIDENCE_SHOW_AFFORDANCE) {
      return { show: false, autoTranslate: false, reason: 'confidence_too_low' };
    }

    return { show: true, autoTranslate: false, reason: 'eligible' };
  }

  private async callProviderWithFallback(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<{ translatedText: string; provider: TranslationProvider; attribution: string }> {
    const providers = this.providerFactory.getOrderedProviders();

    for (const providerClient of providers) {
      try {
        const result = await providerClient.translate(text, sourceLang, targetLang);
        return {
          translatedText: result.translatedText,
          provider: providerClient.name as TranslationProvider,
          attribution: providerClient.attribution,
        };
      } catch (err) {
        this.logger.warn(`Translation provider ${providerClient.name} failed: ${err}`);
      }
    }

    throw Object.assign(new Error(TRANSLATION_ERRORS.UNAVAILABLE), {
      code: TRANSLATION_ERRORS.UNAVAILABLE,
    });
  }

  /** Called when a message is deleted — purge cache (REQ-TRANS-07, GDPR) */
  async purgeMessageTranslations(messageId: string): Promise<void> {
    await this.cache.purgeByMessageId(messageId);
    await this.messageMetaRepo.deleteByMessageId(messageId);
  }

  shouldAutoTranslate(
    confidence: number,
    threshold: number,
    autoEnabled: boolean,
  ): boolean {
    return autoEnabled && confidence >= threshold;
  }

  /** RTL detection — exported for client use */
  isRTL(lang: string): boolean {
    return isRTL(lang);
  }
}