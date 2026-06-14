import { createI18n } from './core';
import { en } from './locales/en';
import { es } from './locales/es';
import { ar } from './locales/ar';
import { fr } from './locales/fr';
import type { Locale, TranslationKey } from './types';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'ar', 'fr'];
export const RTL_LOCALES: Locale[] = ['ar'];

export const i18n = createI18n({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  locales: { en, es, ar, fr },
});

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export type { Locale, TranslationKey };
export { useTranslation } from './hooks';