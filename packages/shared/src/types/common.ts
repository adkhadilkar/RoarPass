/**
 * Shared primitive type aliases used across packages.
 * Extend if additional domain types are needed.
 */

export type UUID = string;
export type ISODateTimeString = string; // ISO 8601
export type BCP47LanguageCode = string; // e.g. "en", "ar", "ko"
export type ISO4217CurrencyCode = string; // e.g. "USD", "EUR"