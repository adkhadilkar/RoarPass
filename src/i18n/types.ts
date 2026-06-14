export type Locale = 'en' | 'es' | 'ar' | 'fr';

export type Direction = 'ltr' | 'rtl';

export interface TranslationMessages {
  [key: string]: string | TranslationMessages;
}

export type TranslationKey = string;

export interface I18nConfig {
  defaultLocale: Locale;
  fallbackLocale: Locale;
  locales: Record<Locale, TranslationMessages>;
}

export interface TranslationContext {
  locale: Locale;
  direction: Direction;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}