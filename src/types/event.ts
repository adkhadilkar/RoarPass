// Shared Event contract — keep consistent across all RoarPass features
export interface Event {
  id: string;
  slug: string;
  name: string;
  /** ISO 8601 start/end in UTC; render localized per i18n locale */
  startsAt: string;
  endsAt: string;
  venue: Venue;
  countryCommunityId: string;
  /** Official, verified information curated by RoarPass editors */
  officialInfo?: OfficialInfoLayer;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2
  latitude?: number;
  longitude?: number;
}

/**
 * Official Info Layer: editorially-verified content shown above
 * community/fan-generated content. Distinct provenance from Local Helper tips.
 */
export interface OfficialInfoLayer {
  source: 'official';
  verifiedAt: string; // ISO 8601
  /** i18n: keyed by BCP-47 locale, with RTL handled at render layer */
  localizedContent: Record<string, OfficialInfoContent>;
  defaultLocale: string;
}

export interface OfficialInfoContent {
  summary: string;
  schedule?: ScheduleItem[];
  accessibility?: string;
  ticketingUrl?: string;
}

export interface ScheduleItem {
  startsAt: string;
  endsAt: string;
  title: string;
  description?: string;
}