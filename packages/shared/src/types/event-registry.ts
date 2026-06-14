import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const EventStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'SUSPENDED',
]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const SportTypeSchema = z.enum([
  'FOOTBALL',
  'RUGBY',
  'CRICKET',
  'BASKETBALL',
  'ATHLETICS',
  'TENNIS',
  'CYCLING',
  'OTHER',
]);
export type SportType = z.infer<typeof SportTypeSchema>;

export const MatchStatusSchema = z.enum([
  'SCHEDULED',
  'LIVE',
  'COMPLETED',
  'POSTPONED',
  'CANCELLED',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const VenueTypeSchema = z.enum([
  'STADIUM',
  'ARENA',
  'OUTDOOR_COURSE',
  'VELODROME',
  'OTHER',
]);
export type VenueType = z.infer<typeof VenueTypeSchema>;

export const CommunityTriggerStatusSchema = z.enum([
  'PENDING',
  'SEEDING',
  'SEEDED',
  'FAILED',
]);
export type CommunityTriggerStatus = z.infer<typeof CommunityTriggerStatusSchema>;

// ─── Country ──────────────────────────────────────────────────────────────────

export const CountrySchema = z.object({
  country_id: z.string().uuid(),
  iso_code: z.string().length(2), // ISO 3166-1 alpha-2
  iso_code_3: z.string().length(3), // ISO 3166-1 alpha-3
  name: z.string().min(1).max(100),
  flag_emoji: z.string().optional(),
  flag_url: z.string().url().optional(),
  primary_language: z.string().length(2), // ISO 639-1
  timezone_default: z.string(), // IANA timezone
  region: z.string().optional(), // e.g. "UEFA", "CONMEBOL"
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Country = z.infer<typeof CountrySchema>;

// ─── Host City ────────────────────────────────────────────────────────────────

export const HostCitySchema = z.object({
  host_city_id: z.string().uuid(),
  country_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  name_local: z.string().optional(), // local language name
  timezone: z.string(), // IANA timezone
  primary_languages: z.array(z.string().length(2)).min(1), // ISO 639-1, ordered
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type HostCity = z.infer<typeof HostCitySchema>;

// ─── Venue ────────────────────────────────────────────────────────────────────

export const VenueSchema = z.object({
  venue_id: z.string().uuid(),
  host_city_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  name_local: z.string().optional(),
  type: VenueTypeSchema,
  capacity: z.number().int().positive().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accessibility_info: z.string().optional(),
  photo_url: z.string().url().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Venue = z.infer<typeof VenueSchema>;

// ─── Team ─────────────────────────────────────────────────────────────────────

export const TeamSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(2).max(10), // e.g. "BRA", "ENG"
  country_id: z.string().uuid().optional(), // null for club teams
  sport: SportTypeSchema,
  crest_url: z.string().url().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  group_stage_group: z.string().optional(), // e.g. "Group A"
  qualified: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

// ─── Match ────────────────────────────────────────────────────────────────────

export const MatchSchema = z.object({
  match_id: z.string().uuid(),
  event_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  host_city_id: z.string().uuid(),
  match_number: z.number().int().positive(),
  stage: z.string(), // "Group Stage", "Quarter Final", "Final", etc.
  home_team_id: z.string().uuid().optional(), // null for TBD
  away_team_id: z.string().uuid().optional(),
  kickoff_utc: z.string().datetime(),
  kickoff_local: z.string(), // ISO 8601 with offset
  local_timezone: z.string(),
  status: MatchStatusSchema,
  home_score: z.number().int().min(0).optional(),
  away_score: z.number().int().min(0).optional(),
  match_notes: z.string().optional(),
  gates_open_minutes_before: z.number().int().positive().default(90),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Match = z.infer<typeof MatchSchema>;

// ─── Event ────────────────────────────────────────────────────────────────────

export const EventSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  short_name: z.string().min(1).max(50),
  sport: SportTypeSchema,
  edition: z.string().optional(), // e.g. "2026", "2027 U20"
  governing_body: z.string().optional(), // e.g. "FIFA", "ICC"
  logo_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  status: EventStatusSchema,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  host_country_ids: z.array(z.string().uuid()).min(1),
  host_city_ids: z.array(z.string().uuid()).min(1),
  participating_team_ids: z.array(z.string().uuid()),
  description: z.string().optional(),
  website_url: z.string().url().optional(),
  timezone_primary: z.string(), // IANA timezone for primary host
  community_seeding_enabled: z.boolean().default(false),
  community_trigger_status: CommunityTriggerStatusSchema.default('PENDING'),
  community_trigger_fired_at: z.string().datetime().optional(),
  activated_at: z.string().datetime().optional(), // when status → ACTIVE
  created_by: z.string().uuid(), // admin user ID
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

// ─── EventActivation ──────────────────────────────────────────────────────────

export const EventActivationSchema = z.object({
  activation_id: z.string().uuid(),
  event_id: z.string().uuid(),
  activated_by: z.string().uuid(), // admin user ID
  previous_status: EventStatusSchema,
  new_status: EventStatusSchema,
  notes: z.string().optional(),
  activated_at: z.string().datetime(),
});
export type EventActivation = z.infer<typeof EventActivationSchema>;

// ─── Community Seed Trigger ───────────────────────────────────────────────────

export const CommunitySeedTriggerSchema = z.object({
  trigger_id: z.string().uuid(),
  event_id: z.string().uuid(),
  triggered_by: z.string().uuid(), // admin user ID
  countries_to_seed: z.array(z.string().uuid()), // country_ids
  status: CommunityTriggerStatusSchema,
  seeded_count: z.number().int().min(0).default(0),
  error_log: z.string().optional(),
  triggered_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
});
export type CommunitySeedTrigger = z.infer<typeof CommunitySeedTriggerSchema>;

// ─── API Request / Response shapes ───────────────────────────────────────────

export const CreateEventSchema = EventSchema.omit({
  event_id: true,
  status: true,
  community_trigger_status: true,
  community_trigger_fired_at: true,
  activated_at: true,
  created_at: true,
  updated_at: true,
}).extend({
  participating_team_ids: z.array(z.string().uuid()).default([]),
  host_city_ids: z.array(z.string().uuid()).min(1),
  host_country_ids: z.array(z.string().uuid()).min(1),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  status: EventStatusSchema.optional(),
});
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export const CreateMatchSchema = MatchSchema.omit({
  match_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateMatchInput = z.infer<typeof CreateMatchSchema>;

export const CreateTeamSchema = TeamSchema.omit({
  team_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const CreateHostCitySchema = HostCitySchema.omit({
  host_city_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateHostCityInput = z.infer<typeof CreateHostCitySchema>;

export const CreateVenueSchema = VenueSchema.omit({
  venue_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;

// ─── List / paginated responses ───────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0),
  has_next: z.boolean(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export type PaginatedEvents = {
  events: Event[];
  pagination: Pagination;
};

export type PaginatedMatches = {
  matches: Match[];
  pagination: Pagination;
};

export type EventWithDetails = Event & {
  host_countries: Country[];
  host_cities: HostCity[];
  participating_teams: Team[];
  matches: Match[];
  venues: Venue[];
};

// ─── Query filters ────────────────────────────────────────────────────────────

export const EventListQuerySchema = z.object({
  status: EventStatusSchema.optional(),
  sport: SportTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
export type EventListQuery = z.infer<typeof EventListQuerySchema>;

export const MatchListQuerySchema = z.object({
  event_id: z.string().uuid().optional(),
  host_city_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
  status: MatchStatusSchema.optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MatchListQuery = z.infer<typeof MatchListQuerySchema>;