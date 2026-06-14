import type { Event, OfficialInfoLayer, OfficialInfoContent } from '../types/event';

/**
 * Resolves the Official Info Layer for an event, selecting the best-matching
 * locale. Falls back to defaultLocale, never throws on missing locale.
 */
export function resolveOfficialInfo(
  event: Event,
  requestedLocale: string,
): OfficialInfoContent | null {
  const layer = event.officialInfo;
  if (!layer) return null;

  return selectLocalizedContent(layer, requestedLocale);
}

export function selectLocalizedContent(
  layer: OfficialInfoLayer,
  requestedLocale: string,
): OfficialInfoContent {
  const exact = layer.localizedContent[requestedLocale];
  if (exact) return exact;

  // BCP-47 language-only fallback (e.g. "ar-EG" -> "ar")
  const base = requestedLocale.split('-')[0];
  const baseMatch = Object.keys(layer.localizedContent).find(
    (k) => k.split('-')[0] === base,
  );
  if (baseMatch) return layer.localizedContent[baseMatch];

  return layer.localizedContent[layer.defaultLocale];
}

/** Provenance guard: official content must be editorially verified. */
export function isVerified(layer: OfficialInfoLayer): boolean {
  return layer.source === 'official' && Boolean(layer.verifiedAt);
}