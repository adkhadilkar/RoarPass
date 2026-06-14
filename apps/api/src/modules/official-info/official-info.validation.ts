/**
 * Zod validation schemas for Official Information & Visa Intelligence layer.
 */

import { z } from 'zod';
import {
  InfoContentType,
  InfoSourceType,
  VisaRequirementType,
  GuideStatus,
  ScheduleMatchStatus,
} from '@roarpass/shared/types/official-info';

const ISO_639_1 = /^[a-z]{2}(-[A-Z]{2})?$/;
const ISO_3166_1_ALPHA_2 = /^[A-Z]{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IANA_TZ_REGEX = /^[A-Za-z]+\/[A-Za-z_]+$/;

const localeSchema = z.string().regex(ISO_639_1, 'Must be ISO 639-1 code');
const uuidSchema = z.string().regex(UUID, 'Must be a valid UUID');

// ─── Localised content ────────────────────────────────────────────────────────

const localisedContentSchema = z.object({
  locale: localeSchema,
  dir: z.enum(['ltr', 'rtl']),
  title: z.string().min(1).max(500),
  body_html: z.string().min(1).max(200_000),
  summary: z.string().max(300).nullable().optional(),
  is_machine_translated: z.boolean().default(false),
});

// ─── Guides ───────────────────────────────────────────────────────────────────

export const listGuidesQuerySchema = z.object({
  event_id: uuidSchema,
  host_city_id: uuidSchema.optional(),
  content_type: z.nativeEnum(InfoContentType).optional(),
  locale: localeSchema.optional(),
  status: z.nativeEnum(GuideStatus).optional().default(GuideStatus.PUBLISHED),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export const createGuideBodySchema = z.object({
  event_id: uuidSchema,
  host_city_id: uuidSchema,
  content_type: z.enum([InfoContentType.EVENT_GUIDE, InfoContentType.CITY_GUIDE]),
  source_id: uuidSchema,
  localisations: z.array(localisedContentSchema).min(1),
  tags: z.array(z.string().max(64)).optional().default([]),
  valid_from: z.string().datetime({ offset: true }).optional(),
  valid_until: z.string().datetime({ offset: true }).optional(),
});

export const updateGuideBodySchema = z.object({
  status: z.nativeEnum(GuideStatus).optional(),
  source_id: uuidSchema.optional(),
  localisations: z.array(localisedContentSchema).optional(),
  tags: z.array(z.string().max(64)).optional(),
  valid_from: z.string().datetime({ offset: true }).nullable().optional(),
  valid_until: z.string().datetime({ offset: true }).nullable().optional(),
});

// ─── Match schedule ───────────────────────────────────────────────────────────

export const listMatchScheduleQuerySchema = z.object({
  event_id: uuidSchema,
  host_city_id: uuidSchema.optional(),
  viewer_timezone: z.string().regex(IANA_TZ_REGEX, 'Must be IANA timezone').optional(),
  status: z.nativeEnum(ScheduleMatchStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  group_by_date: z.coerce.boolean().optional().default(false),
});

// ─── Visa intelligence ────────────────────────────────────────────────────────

export const getVisaIntelligenceQuerySchema = z.object({
  event_id: uuidSchema,
  nationality_code: z.string().regex(ISO_3166_1_ALPHA_2, 'Must be ISO 3166-1 alpha-2'),
  destination_country_code: z.string().regex(ISO_3166_1_ALPHA_2, 'Must be ISO 3166-1 alpha-2'),
});

export const listVisaNationalityQuerySchema = z.object({
  event_id: uuidSchema,
});

const visaLocalisationSchema = z.object({
  locale: localeSchema,
  dir: z.enum(['ltr', 'rtl']),
  summary: z.string().max(300),
});

export const upsertVisaIntelligenceBodySchema = z.object({
  event_id: uuidSchema,
  nationality_code: z.string().regex(ISO_3166_1_ALPHA_2),
  destination_country_code: z.string().regex(ISO_3166_1_ALPHA_2),
  requirement_type: z.nativeEnum(VisaRequirementType),
  max_stay_days: z.number().int().positive().nullable().optional(),
  conditions: z.string().min(1).max(5000),
  official_portal_url: z.string().url().max(2000),
  supplementary_portal_urls: z.array(z.string().url().max(2000)).optional().default([]),
  source_id: uuidSchema,
  last_confirmed_at: z.string().datetime({ offset: true }),
  data_expiry_date: z.string().datetime({ offset: true }),
  disclaimer: z.string().min(1).max(1000),
  localisations: z.array(visaLocalisationSchema).optional().default([]),
});

// ─── Source management ────────────────────────────────────────────────────────

export const upsertSourceBodySchema = z.object({
  source_type: z.nativeEnum(InfoSourceType),
  name: z.string().min(1).max(255),
  url: z.string().url().max(2000),
  logo_url: z.string().url().max(2000).optional(),
  trust_verified: z.boolean().optional().default(false),
  verification_notes: z.string().max(2000).optional(),
});