/**
 * Locale & RTL utility helpers — shared across web and mobile.
 */

import { RTL_LOCALES, LOCALE_CONFIGS, type LocaleConfig, type TextDirection } from '../types/platform-foundation';

/**
 * Determine text direction from any BCP-47 locale tag.
 * Gracefully handles region variants like 'ar-SA', 'he-IL', 'ur-PK'.
 */
export function getDirectionForLocale(locale: string): TextDirection {
  const base = locale.split('-')[0].toLowerCase() as SupportedLocale;
  return RTL_LOCALES.has(base) ? 'rtl' : 'ltr';
}

/**
 * Return the `LocaleConfig` for a given locale string, falling back to English.
 */
export function getLocaleConfig(locale: string): LocaleConfig {
  const base = locale.split('-')[0].toLowerCase() as SupportedLocale;
  return LOCALE_CONFIGS[base] ?? LOCALE_CONFIGS['en'];
}

/**
 * Format a UTC ISO 8601 string into a locale-aware display string.
 * Returns BOTH host-city and user-timezone representations.
 */
export function formatDualTimezone(
  isoString: string,
  userTimezone: string,
  hostCityTimezone: string,
  locale: string,
): { userDisplay: string; hostDisplay: string } {
  const cfg = getLocaleConfig(locale);
  const dtFormatUser = new Intl.DateTimeFormat(cfg.currencyLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: userTimezone,
    hour12: cfg.timeFormat === '12h',
  });
  const dtFormatHost = new Intl.DateTimeFormat(cfg.currencyLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: hostCityTimezone,
    hour12: cfg.timeFormat === '12h',
  });
  const date = new Date(isoString);
  return {
    userDisplay: dtFormatUser.format(date),
    hostDisplay: dtFormatHost.format(date),
  };
}

/**
 * Format a currency amount in a locale-aware way.
 * Always carries ISO 4217 currency code in structured data.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale: string,
): string {
  const cfg = getLocaleConfig(locale);
  return new Intl.NumberFormat(cfg.currencyLocale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

/**
 * Determine if a text run requires bidi isolation (mixed-direction content).
 * Used by RTL overlay handling in translated messages.
 */
export function requiresBidiIsolation(sourceLocale: string, targetLocale: string): boolean {
  return getDirectionForLocale(sourceLocale) !== getDirectionForLocale(targetLocale);
}