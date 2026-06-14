/**
 * Platform Foundation — Shared TypeScript Contracts
 * Covers: multi-region config, security, GDPR/CCPA/PDPA, i18n, a11y, performance budgets.
 */

// ---------------------------------------------------------------------------
// Region & Multi-Cloud
// ---------------------------------------------------------------------------

export type CloudRegion =
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-northeast-1';

export type DataResidencyZone = 'US' | 'EU' | 'APAC' | 'GLOBAL';

export interface RegionConfig {
  region: CloudRegion;
  dataResidencyZone: DataResidencyZone;
  isPrimary: boolean;
  latencyBudgetMs: number; // p95 target for this region
  failoverRegion?: CloudRegion;
}

// ---------------------------------------------------------------------------
// Performance Budgets (PRD §8.1)
// ---------------------------------------------------------------------------

export interface PerformanceBudget {
  /** p95 API response for standard (non-LLM) endpoints */
  apiResponseP95Ms: 300;
  /** p95 for AI Trip Assistant turns */
  aiTurnResponseP95Ms: 5000;
  /** p95 target for AI responses */
  aiTurnResponseTargetMs: 3000;
  /** Core Web Vitals: Largest Contentful Paint */
  lcpTargetMs: 2500;
  /** Core Web Vitals: First Input Delay */
  fidTargetMs: 100;
  /** Core Web Vitals: Cumulative Layout Shift */
  clsTarget: 0.1;
  /** Offline-first operations (phrase cards, cached data) */
  offlineOperationTargetMs: 100;
}

export const PERFORMANCE_BUDGET: PerformanceBudget = {
  apiResponseP95Ms: 300,
  aiTurnResponseP95Ms: 5000,
  aiTurnResponseTargetMs: 3000,
  lcpTargetMs: 2500,
  fidTargetMs: 100,
  clsTarget: 0.1,
  offlineOperationTargetMs: 100,
};

// ---------------------------------------------------------------------------
// Security (PRD §8.3)
// ---------------------------------------------------------------------------

export type SecurityRole = 'GUEST' | 'FAN' | 'LOCAL_HELPER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface JwtClaims {
  sub: string; // user_id (UUID)
  roles: SecurityRole[];
  eventContext?: string; // event_id if scoped
  dataResidencyZone: DataResidencyZone;
  iat: number;
  exp: number;
  jti: string; // unique token id for revocation
}

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  burstAllowance?: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'translation.translate': { windowSeconds: 60, maxRequests: 100 },
  'assistant.turn': { windowSeconds: 3600, maxRequests: 100 },
  'auth.login': { windowSeconds: 300, maxRequests: 10 },
  'auth.register': { windowSeconds: 3600, maxRequests: 5 },
  'sos.activate': { windowSeconds: 60, maxRequests: 10 },
};

// ---------------------------------------------------------------------------
// Privacy / GDPR / CCPA / PDPA (PRD §8.4)
// ---------------------------------------------------------------------------

export type ConsentCategory =
  | 'essential'
  | 'analytics'
  | 'marketing'
  | 'ai_processing'
  | 'third_party_translation'
  | 'location'
  | 'biometric';

export type LegalBasis =
  | 'consent'
  | 'legitimate_interest'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interest'
  | 'public_task';

export interface ConsentRecord {
  consentId: string; // UUID
  userId: string; // UUID
  category: ConsentCategory;
  granted: boolean;
  legalBasis: LegalBasis;
  grantedAt?: string; // ISO 8601
  revokedAt?: string; // ISO 8601
  jurisdiction: string; // ISO 3166-1 alpha-2, e.g. 'DE', 'US', 'TH'
  ipAddressHash: string; // SHA-256, not raw IP
  userAgentHash: string; // SHA-256
  version: string; // consent policy version
}

export interface DataSubjectRequest {
  requestId: string;
  userId: string;
  type: 'ACCESS' | 'DELETION' | 'PORTABILITY' | 'RECTIFICATION' | 'RESTRICTION' | 'OBJECTION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'PARTIALLY_COMPLETED';
  submittedAt: string; // ISO 8601
  dueAt: string; // ISO 8601 – 30 days from submission (GDPR), 45 days (CCPA)
  completedAt?: string;
  notes?: string;
  affectedServices: string[]; // slugs of services that hold data
}

export interface DataRetentionPolicy {
  dataCategory: string;
  retentionDays: number;
  legalBasis: LegalBasis;
  reviewCycle: 'annual' | 'biannual' | 'quarterly';
  autoDeleteEnabled: boolean;
}

export const DATA_RETENTION_POLICIES: DataRetentionPolicy[] = [
  { dataCategory: 'user_profile', retentionDays: 2555 /* 7 years */, legalBasis: 'contract', reviewCycle: 'annual', autoDeleteEnabled: false },
  { dataCategory: 'conversation_turns', retentionDays: 90, legalBasis: 'legitimate_interest', reviewCycle: 'quarterly', autoDeleteEnabled: true },
  { dataCategory: 'translation_cache', retentionDays: 30, legalBasis: 'legitimate_interest', reviewCycle: 'quarterly', autoDeleteEnabled: true },
  { dataCategory: 'audit_logs', retentionDays: 365, legalBasis: 'legal_obligation', reviewCycle: 'annual', autoDeleteEnabled: false },
  { dataCategory: 'analytics_events', retentionDays: 730, legalBasis: 'consent', reviewCycle: 'annual', autoDeleteEnabled: true },
  { dataCategory: 'consent_records', retentionDays: 3650 /* 10 years */, legalBasis: 'legal_obligation', reviewCycle: 'annual', autoDeleteEnabled: false },
];

// ---------------------------------------------------------------------------
// i18n / RTL (PRD §8.6)
// ---------------------------------------------------------------------------

export type SupportedLocale =
  | 'en' | 'ar' | 'fr' | 'es' | 'pt' | 'ja' | 'ko'
  | 'hi' | 'ur' | 'zh' | 'de' | 'it' | 'nl' | 'ru'
  | 'he' | 'fa' | 'tr' | 'pl' | 'sv' | 'id';

export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>([
  'ar', 'he', 'ur', 'fa',
]);

export const MINIMUM_SUPPORTED_LOCALES: SupportedLocale[] = [
  'en', 'ar', 'fr', 'es', 'pt', 'ja', 'ko', 'hi', 'ur', 'zh',
  'de', 'it', 'nl', 'ru', 'he', 'fa', 'tr', 'pl', 'sv', 'id',
];

export type TextDirection = 'ltr' | 'rtl';

export function getTextDirection(locale: string): TextDirection {
  return RTL_LOCALES.has(locale as SupportedLocale) ? 'rtl' : 'ltr';
}

export interface LocaleConfig {
  locale: SupportedLocale;
  direction: TextDirection;
  dateFormat: string; // e.g. 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY年MM月DD日'
  timeFormat: '12h' | '24h';
  currencyLocale: string; // IETF BCP 47 for Intl.NumberFormat
  nativeName: string;
  englishName: string;
}

export const LOCALE_CONFIGS: Record<SupportedLocale, LocaleConfig> = {
  en: { locale: 'en', direction: 'ltr', dateFormat: 'MM/DD/YYYY', timeFormat: '12h', currencyLocale: 'en-US', nativeName: 'English', englishName: 'English' },
  ar: { locale: 'ar', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: '12h', currencyLocale: 'ar-SA', nativeName: 'العربية', englishName: 'Arabic' },
  fr: { locale: 'fr', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'fr-FR', nativeName: 'Français', englishName: 'French' },
  es: { locale: 'es', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'es-ES', nativeName: 'Español', englishName: 'Spanish' },
  pt: { locale: 'pt', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'pt-BR', nativeName: 'Português', englishName: 'Portuguese' },
  ja: { locale: 'ja', direction: 'ltr', dateFormat: 'YYYY年MM月DD日', timeFormat: '24h', currencyLocale: 'ja-JP', nativeName: '日本語', englishName: 'Japanese' },
  ko: { locale: 'ko', direction: 'ltr', dateFormat: 'YYYY년 MM월 DD일', timeFormat: '24h', currencyLocale: 'ko-KR', nativeName: '한국어', englishName: 'Korean' },
  hi: { locale: 'hi', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '12h', currencyLocale: 'hi-IN', nativeName: 'हिन्दी', englishName: 'Hindi' },
  ur: { locale: 'ur', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: '12h', currencyLocale: 'ur-PK', nativeName: 'اردو', englishName: 'Urdu' },
  zh: { locale: 'zh', direction: 'ltr', dateFormat: 'YYYY年MM月DD日', timeFormat: '24h', currencyLocale: 'zh-CN', nativeName: '中文', englishName: 'Chinese' },
  de: { locale: 'de', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: '24h', currencyLocale: 'de-DE', nativeName: 'Deutsch', englishName: 'German' },
  it: { locale: 'it', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'it-IT', nativeName: 'Italiano', englishName: 'Italian' },
  nl: { locale: 'nl', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'nl-NL', nativeName: 'Nederlands', englishName: 'Dutch' },
  ru: { locale: 'ru', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: '24h', currencyLocale: 'ru-RU', nativeName: 'Русский', englishName: 'Russian' },
  he: { locale: 'he', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'he-IL', nativeName: 'עברית', englishName: 'Hebrew' },
  fa: { locale: 'fa', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'fa-IR', nativeName: 'فارسی', englishName: 'Farsi' },
  tr: { locale: 'tr', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: '24h', currencyLocale: 'tr-TR', nativeName: 'Türkçe', englishName: 'Turkish' },
  pl: { locale: 'pl', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: '24h', currencyLocale: 'pl-PL', nativeName: 'Polski', englishName: 'Polish' },
  sv: { locale: 'sv', direction: 'ltr', dateFormat: 'YYYY-MM-DD', timeFormat: '24h', currencyLocale: 'sv-SE', nativeName: 'Svenska', englishName: 'Swedish' },
  id: { locale: 'id', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', currencyLocale: 'id-ID', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
};

// ---------------------------------------------------------------------------
// Accessibility (WCAG 2.1 AA) — PRD §9.4
// ---------------------------------------------------------------------------

export interface AccessibilityConfig {
  /** Minimum contrast ratio for normal text (WCAG AA) */
  minContrastRatioNormal: 4.5;
  /** Minimum contrast ratio for large text ≥18pt or 14pt bold (WCAG AA) */
  minContrastRatioLarge: 3.0;
  /** Minimum contrast ratio for safety-critical UI (WCAG AAA target) */
  minContrastRatioSafetyCritical: 7.0;
  /** Minimum touch target size in px */
  minTouchTargetPx: 44;
  /** Minimum font size for show-screen / large-font mode (pt on iOS, sp on Android) */
  largeModeFontSizePt: 28;
  largeModeLineHeightMultiplier: 1.4;
}

export const A11Y_CONFIG: AccessibilityConfig = {
  minContrastRatioNormal: 4.5,
  minContrastRatioLarge: 3.0,
  minContrastRatioSafetyCritical: 7.0,
  minTouchTargetPx: 44,
  largeModeFontSizePt: 28,
  largeModeLineHeightMultiplier: 1.4,
};

// ---------------------------------------------------------------------------
// Scalability & Caching (PRD §8.2)
// ---------------------------------------------------------------------------

export interface CacheConfig {
  translationCacheTtlDays: 30;
  phrasecardCacheTtlHours: 24;
  helperAvailabilityCacheTtlMinutes: 5;
  eventScheduleCacheTtlMinutes: 5;
  /** Probabilistic early expiry factor for stampede prevention (0–1) */
  stampedeProbabilisticFactor: 0.1;
}

export const CACHE_CONFIG: CacheConfig = {
  translationCacheTtlDays: 30,
  phrasecardCacheTtlHours: 24,
  helperAvailabilityCacheTtlMinutes: 5,
  eventScheduleCacheTtlMinutes: 5,
  stampedeProbabilisticFactor: 0.1,
};

// ---------------------------------------------------------------------------
// Error envelope (shared across all services)
// ---------------------------------------------------------------------------

export interface ApiErrorEnvelope {
  error: string; // machine-readable code, e.g. 'TRANSLATION_UNAVAILABLE'
  message: string; // human-readable, i18n key or string
  requestId: string; // correlation ID
  timestamp: string; // ISO 8601
  statusCode: number;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}