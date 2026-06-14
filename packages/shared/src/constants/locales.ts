export const SUPPORTED_LOCALES = [
  "en", "ar", "fr", "es", "pt", "ja", "ko", "hi", "ur",
  "zh", "de", "it", "nl", "ru", "tr", "he", "fa", "th", "vi", "pl",
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const RTL_LOCALES = new Set<string>(["ar", "he", "ur", "fa"]);

export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en: "English", ar: "العربية", fr: "Français", es: "Español",
  pt: "Português", ja: "日本語", ko: "한국어", hi: "हिन्दी",
  ur: "اردو", zh: "中文", de: "Deutsch", it: "Italiano",
  nl: "Nederlands", ru: "Русский", tr: "Türkçe", he: "עברית",
  fa: "فارسی", th: "ไทย", vi: "Tiếng Việt", pl: "Polski",
};

export const DEFAULT_LOCALE: SupportedLocale = "en";