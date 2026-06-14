import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LOCALES = ['en', 'ar', 'he', 'es', 'fr', 'de', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: Locale[] = ['ar', 'he'];

export function isRTL(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'cookie', 'navigator'],
      caches: ['cookie'],
    },
    react: { useSuspense: true },
  });

export default i18n;