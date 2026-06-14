import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const TranslationProviderEnum = z.enum(['DEEPL', 'GOOGLE', 'AZURE']);
export type TranslationProvider = z.infer<typeof TranslationProviderEnum>;

export const PhraseCategoryEnum = z.enum([
  'MEDICAL',
  'POLICE',
  'NAVIGATION',
  'STADIUM',
  'LANGUAGE_BARRIER',
  'DIETARY',
  'ACCOMMODATION',
]);
export type PhraseCategory = z.infer<typeof PhraseCategoryEnum>;

// ─── User Translation Preferences ──────────────────────────────────────────

export const UserTranslationPreferenceSchema = z.object({
  user_id: z.string().uuid(),
  preferred_language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Must be ISO 639-1 or BCP-47'),
  auto_translate_enabled: z.boolean().default(false),
  auto_translate_threshold: z.number().min(0).max(1).default(0.8),
  updated_at: z.string().datetime(),
});
export type UserTranslationPreference = z.infer<typeof UserTranslationPreferenceSchema>;

export const PatchUserTranslationPreferenceSchema = UserTranslationPreferenceSchema.pick({
  preferred_language: true,
  auto_translate_enabled: true,
  auto_translate_threshold: true,
}).partial();
export type PatchUserTranslationPreference = z.infer<typeof PatchUserTranslationPreferenceSchema>;

// ─── Message Translation Metadata ──────────────────────────────────────────

export const MessageTranslationMetadataSchema = z.object({
  message_id: z.string().uuid(),
  detected_language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  detection_confidence: z.number().min(0).max(1),
  is_official: z.boolean().default(false),
  detected_at: z.string().datetime(),
});
export type MessageTranslationMetadata = z.infer<typeof MessageTranslationMetadataSchema>;

// ─── Translation Cache ───────────────────────────────────────────────────────

export const TranslationCacheSchema = z.object({
  cache_id: z.string().uuid(),
  message_id: z.string().uuid(),
  target_language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  translated_text: z.string(),
  provider: TranslationProviderEnum,
  provider_attribution: z.string(),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});
export type TranslationCache = z.infer<typeof TranslationCacheSchema>;

// ─── Translation Request / Response ─────────────────────────────────────────

export const TranslateMessageRequestSchema = z.object({
  target_language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional(),
});
export type TranslateMessageRequest = z.infer<typeof TranslateMessageRequestSchema>;

export const TranslateMessageResponseSchema = z.object({
  message_id: z.string().uuid(),
  source_language: z.string(),
  target_language: z.string(),
  translated_text: z.string(),
  provider: TranslationProviderEnum,
  provider_attribution: z.string(),
  from_cache: z.boolean(),
  detection_confidence: z.number(),
  is_partial: z.boolean().default(false), // EC-8: truncated long message
});
export type TranslateMessageResponse = z.infer<typeof TranslateMessageResponseSchema>;

// ─── Language Detection (Internal) ──────────────────────────────────────────

export const DetectLanguageRequestSchema = z.object({
  message_id: z.string().uuid(),
  text: z.string().max(5000),
});
export type DetectLanguageRequest = z.infer<typeof DetectLanguageRequestSchema>;

export const DetectLanguageResponseSchema = z.object({
  detected_language: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DetectLanguageResponse = z.infer<typeof DetectLanguageResponseSchema>;

// ─── Phrase Cards ────────────────────────────────────────────────────────────

export const PhraseCardSchema = z.object({
  phrase_id: z.string().uuid(),
  category: PhraseCategoryEnum,
  source_text: z.string(),
  target_language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  translated_text: z.string(),
  romanization: z.string().nullable(),
  tts_audio_url: z.string().url().nullable(),
  is_active: z.boolean(),
  created_by: z.string().uuid(),
  updated_at: z.string().datetime(),
});
export type PhraseCard = z.infer<typeof PhraseCardSchema>;

export const PhraseCardPublicSchema = PhraseCardSchema.pick({
  phrase_id: true,
  category: true,
  source_text: true,
  target_language: true,
  translated_text: true,
  romanization: true,
  tts_audio_url: true,
});
export type PhraseCardPublic = z.infer<typeof PhraseCardPublicSchema>;

export const PhraseCardsResponseSchema = z.object({
  target_language: z.string(),
  cards: z.array(PhraseCardPublicSchema),
});
export type PhraseCardsResponse = z.infer<typeof PhraseCardsResponseSchema>;

// ─── Event Host Language Mapping ─────────────────────────────────────────────

export const EventHostLanguageMappingSchema = z.object({
  event_id: z.string().uuid(),
  host_city_id: z.string().uuid(),
  primary_languages: z.array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/)).min(1),
  phrase_cards_ready: z.boolean(),
});
export type EventHostLanguageMapping = z.infer<typeof EventHostLanguageMappingSchema>;

export const UpsertHostLanguagesSchema = z.object({
  primary_languages: z.array(z.string()).min(1),
  phrase_cards_ready: z.boolean(),
});
export type UpsertHostLanguages = z.infer<typeof UpsertHostLanguagesSchema>;

// ─── Admin Phrase Card Mutations ─────────────────────────────────────────────

export const CreatePhraseCardSchema = PhraseCardSchema.omit({
  phrase_id: true,
  is_active: true,
  created_by: true,
  updated_at: true,
});
export type CreatePhraseCard = z.infer<typeof CreatePhraseCardSchema>;

export const UpdatePhraseCardSchema = CreatePhraseCardSchema.partial();
export type UpdatePhraseCard = z.infer<typeof UpdatePhraseCardSchema>;

// ─── RTL language set ────────────────────────────────────────────────────────

export const RTL_LANGUAGES = new Set(['ar', 'he', 'ur', 'fa']);

export function isRTL(lang: string): boolean {
  const base = lang.split('-')[0];
  return RTL_LANGUAGES.has(base);
}

// ─── Translation error codes ─────────────────────────────────────────────────

export const TRANSLATION_ERRORS = {
  SUPPRESSED_OFFICIAL: 'TRANSLATION_SUPPRESSED_OFFICIAL',
  UNAVAILABLE: 'TRANSLATION_UNAVAILABLE',
  RATE_LIMITED: 'TRANSLATION_RATE_LIMITED',
  SAME_LANGUAGE: 'TRANSLATION_SAME_LANGUAGE',
  EMPTY_RESULT: 'TRANSLATION_EMPTY_RESULT',
} as const;

export type TranslationError = (typeof TRANSLATION_ERRORS)[keyof typeof TRANSLATION_ERRORS];