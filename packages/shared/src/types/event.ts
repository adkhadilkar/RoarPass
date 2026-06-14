import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const SportType = z.enum([
  'FOOTBALL',
  'CRICKET',
  'RUGBY',
  'BASKETBALL',
  'BASEBALL',
  'ATHLETICS',
  'OTHER',
]);
export type SportType = z.infer<typeof SportType>;

export const EventStatus = z.enum([
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);
export type EventStatus = z.infer<typeof EventStatus>;

export const MatchStatus = z.enum([
  'SCHEDULED',
  'LIVE',
  'COMPLETED',
  'POSTPONED',
  'CANCELLED',
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const HostCityStatus = z.enum(['PENDING', 'ACTIVE', 'RETIRED']);
export type HostCityStatus = z.infer<typeof HostCityStatus>;

// ─── Core Schemas ─────────────────────────────────────────────────────────────

export const TeamSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  country_code: z.string().length(2), // ISO 3166-1 alpha-2
  sport: SportType,
  logo_url: z.string().url().nullable(),
  group_code: z.string().max(10).nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const VenueSchema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().min(1).max(300),
  city: z.string().min(1).max(200),
  country_code: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacity: z.number().int().positive().nullable(),
  address: z.string().max(500).nullable(),
  timezone: z.string().min(1).max(100), // IANA tz, e.g. "America/Chicago"
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const HostCitySchema = z.object({
  host_city_id: z.string().uuid(),
  event_id: z.string().uuid(),
  city: z.string().min(1).max(200),
  country_code: z.string().length(2),
  timezone: z.string().min(1).max(100),
  status: HostCityStatus,
  primary_languages: z.array(z.string().min(2).max(10)).min(1), // ISO 639-1
  phrase_cards_ready: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type HostCity = z.infer<typeof HostCitySchema>;

export const MatchSchema = z.object({
  match_id: z.string().uuid(),
  event_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  home_team_id: z.string().uuid().nullable(), // null for TBD group-stage
  away_team_id: z.string().uuid().nullable(),
  match_number: z.number().int().positive(),
  round: z.string().max(100), // "Group Stage A", "Quarter Final", etc.
  kickoff_utc: z.string().datetime(),
  kickoff_local: z.string().datetime(), // wall-clock in venue timezone
  status: MatchStatus,
  score_home: z.number().int().min(0).nullable(),
  score_away: z.number().int().min(0).nullable(),
  is_featured: z.boolean(),
  notes: z.string().max(1000).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Match = z.infer<typeof MatchSchema>;

export const EventSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(1).max(300),
  short_name: z.string().min(1).max(50),
  sport: SportType,
  edition_year: z.number().int().min(2000).max(2100),
  organizer: z.string().min(1).max(300),
  logo_url: z.string().url().nullable(),
  banner_url: z.string().url().nullable(),
  start_date: z.string().date(), // YYYY-MM-DD
  end_date: z.string().date(),
  status: EventStatus,
  // Activation controls community seeding
  activated_at: z.string().datetime().nullable(),
  deactivated_at: z.string().datetime().nullable(),
  // Configurable options
  registration_open: z.boolean(),
  max_teams: z.number().int().positive().nullable(),
  description: z.string().max(5000).nullable(),
  website_url: z.string().url().nullable(),
  created_by: z.string().uuid(), // admin user id
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

// ─── Aggregate / Response Types ───────────────────────────────────────────────

export const EventDetailSchema = EventSchema.extend({
  host_cities: z.array(HostCitySchema),
  teams: z.array(TeamSchema),
  matches: z.array(MatchSchema),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const EventSummarySchema = EventSchema.pick({
  event_id: true,
  name: true,
  short_name: true,
  sport: true,
  edition_year: true,
  start_date: true,
  end_date: true,
  status: true,
  logo_url: true,
  registration_open: true,
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

// ─── Request / Input Schemas ─────────────────────────────────────────────────

export const CreateEventInputSchema = EventSchema.omit({
  event_id: true,
  created_at: true,
  updated_at: true,
  activated_at: true,
  deactivated_at: true,
  created_by: true,
}).extend({
  host_cities: z
    .array(
      HostCitySchema.omit({
        host_city_id: true,
        event_id: true,
        created_at: true,
        updated_at: true,
        phrase_cards_ready: true,
      })
    )
    .optional(),
  team_ids: z.array(z.string().uuid()).optional(), // link existing teams
});
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

export const UpdateEventInputSchema = CreateEventInputSchema.partial();
export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

export const CreateTeamInputSchema = TeamSchema.omit({
  team_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>;

export const CreateMatchInputSchema = MatchSchema.omit({
  match_id: true,
  created_at: true,
  updated_at: true,
  score_home: true,
  score_away: true,
});
export type CreateMatchInput = z.infer<typeof CreateMatchInputSchema>;

export const UpdateMatchInputSchema = CreateMatchInputSchema.partial().extend({
  score_home: z.number().int().min(0).optional(),
  score_away: z.number().int().min(0).optional(),
});
export type UpdateMatchInput = z.infer<typeof UpdateMatchInputSchema>;

export const ActivateEventInputSchema = z.object({
  event_id: z.string().uuid(),
  seed_communities: z.boolean().default(true),
});
export type ActivateEventInput = z.infer<typeof ActivateEventInputSchema>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    total_pages: z.number().int(),
  });

// ─── Community Seeding Event (Domain Event) ───────────────────────────────────

export interface EventActivatedDomainEvent {
  type: 'EVENT_ACTIVATED';
  event_id: string;
  event_name: string;
  sport: SportType;
  host_cities: Array<{
    host_city_id: string;
    city: string;
    country_code: string;
    primary_languages: string[];
  }>;
  teams: Array<{
    team_id: string;
    name: string;
    country_code: string;
  }>;
  activated_at: string;
  seed_communities: boolean;
}

export interface EventDeactivatedDomainEvent {
  type: 'EVENT_DEACTIVATED';
  event_id: string;
  deactivated_at: string;
}

export type EventDomainEvent = EventActivatedDomainEvent | EventDeactivatedDomainEvent;