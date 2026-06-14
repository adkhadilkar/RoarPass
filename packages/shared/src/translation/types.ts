import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TranslationProvider = {
  DEEPL: 'DEEPL',
  GOOGLE: 'GOOGLE',
  AZURE: 'AZURE',
} as const;
export type TranslationProvider = (typeof TranslationProvider)[keyof typeof TranslationProvider];

export const PhraseCategory = {
  MEDICAL: 'MEDICAL',
  POLICE: 'POLICE',
  NAVIGATION: 'NAVIGATION',
  STADIUM: 'STADIUM',
  LANGUAGE_BARRIER: 'LANGUAGE_BARRIER',
  DIETARY: 'DIETARY',
  ACCOMMODATION: 'ACCOMMODATION',
} as const;
export type PhraseCategory = (typeof PhraseCategory)[keyof typeof PhraseCategory];

export const TranslationErrorCode = {
  TRANSLATION_SUPPRESSED_OFFICIAL: 'TRANSLATION_SUPPRESSED_OFFICIAL',
  TRANSLATION_UNAVAILABLE: 'TRANSLATION_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  SAME_LANGUAGE: 'SAME_LANGUAGE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;
export type TranslationErrorCode = (typeof TranslationErrorCode)[keyof typeof TranslationErrorCode];

// ─── Zod Schemas (shared validation) ─────────────────────────────────────────

export const Iso639_1Schema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Must be a valid ISO 639-1 language code');

export const UserTranslationPreferenceSchema = z.object({
  user_id: z.string().uuid(),
  preferred_language: Iso639_1Schema,
  auto_translate_enabled: z.boolean().default(false),
  auto_translate_threshold: z.number().min(0).max(1).default(0.8),
  updated_at: z.string().datetime(),
});
export type UserTranslationPreference = z.infer<typeof UserTranslationPreferenceSchema>;

export const MessageTranslationMetadataSchema = z.object({
  message_id: z.string().uuid(),
  detected_language: Iso639_1Schema.nullable(),
  detection_confidence: z.number().min(0).max(1).nullable(),
  is_official: z.boolean().default(false),
  detected_at: z.string().datetime().nullable(),
});
export type MessageTranslationMetadata = z.infer<typeof MessageTranslationMetadataSchema>;

export const TranslationCacheSchema = z.object({
  cache_id: z.string().uuid(),
  message_id: z.string().uuid(),
  target_language: Iso639_1Schema,
  translated_text: z.string(),
  provider: z.nativeEnum(TranslationProvider),
  provider_attribution: z.string(),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});
export type TranslationCache = z.infer<typeof TranslationCacheSchema>;

export const PhraseCardSchema = z.object({
  phrase_id: z.string().uuid(),
  category: z.nativeEnum(PhraseCategory),
  source_text: z.string().min(1).max(500),
  target_language: Iso639_1Schema,
  translated_text: z.string().min(1),
  romanization: z.string().nullable().optional(),
  tts_audio_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: z.string().uuid(),
  updated_at: z.string().datetime(),
});
export type PhraseCard = z.infer<typeof PhraseCardSchema>;

export const EventHostLanguageMappingSchema = z.object({
  event_id: z.string().uuid(),
  host_city_id: z.string().uuid(),
  primary_languages: z.array(Iso639_1Schema).min(1),
  phrase_cards_ready: z.boolean().default(false),
});
export type EventHostLanguageMapping = z.infer<typeof EventHostLanguageMappingSchema>;

// ─── API Contracts ─────────────────────────────────────────────────────────────

export const TranslateMessageRequestSchema = z.object({
  target_language: Iso639_1Schema.optional(),
});
export type TranslateMessageRequest = z.infer<typeof TranslateMessageRequestSchema>;

export const TranslateMessageResponseSchema = z.object({
  message_id: z.string().uuid(),
  source_language: Iso639_1Schema,
  target_language: Iso639_1Schema,
  translated_text: z.string(),
  provider: z.nativeEnum(TranslationProvider),
  provider_attribution: z.string(),
  from_cache: z.boolean(),
  detection_confidence: z.number().nullable(),
});
export type TranslateMessageResponse = z.infer<typeof TranslateMessageResponseSchema>;

export const UpdateTranslationPreferenceSchema = z.object({
  preferred_language: Iso639_1Schema.optional(),
  auto_translate_enabled: z.boolean().optional(),
  auto_translate_threshold: z.number().min(0).max(1).optional(),
});
export type UpdateTranslationPreference = z.infer<typeof UpdateTranslationPreferenceSchema>;

export const PhraseCardQuerySchema = z.object({
  target_language: Iso639_1Schema,
  category: z.nativeEnum(PhraseCategory).optional(),
  event_id: z.string().uuid().optional(),
});
export type PhraseCardQuery = z.infer<typeof PhraseCardQuerySchema>;

export const PhraseCardListResponseSchema = z.object({
  target_language: Iso639_1Schema,
  cards: z.array(PhraseCardSchema),
});
export type PhraseCardListResponse = z.infer<typeof PhraseCardListResponseSchema>;

// ─── Internal service contracts ───────────────────────────────────────────────

export const DetectLanguageRequestSchema = z.object({
  message_id: z.string().uuid(),
  text: z.string().min(1).max(5000),
});
export type DetectLanguageRequest = z.infer<typeof DetectLanguageRequestSchema>;

export const DetectLanguageResponseSchema = z.object({
  detected_language: Iso639_1Schema,
  confidence: z.number().min(0).max(1),
});
export type DetectLanguageResponse = z.infer<typeof DetectLanguageResponseSchema>;

// ─── RTL language set ─────────────────────────────────────────────────────────

export const RTL_LANGUAGES = new Set(['ar', 'he', 'ur', 'fa']);
export function isRtlLanguage(lang: string): boolean {
  return RTL_LANGUAGES.has(lang.split('-')[0]);
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TRANSLATION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MIN_CONFIDENCE_FOR_AFFORDANCE = 0.5;
export const DEFAULT_AUTO_TRANSLATE_THRESHOLD = 0.8;
export const MAX_TRANSLATION_TEXT_LENGTH = 5000;
export const PHRASE_CARD_CACHE_MAX_AGE_SECONDS = 86400; // 24h