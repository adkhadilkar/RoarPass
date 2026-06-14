import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TransportMode {
  FLIGHT = 'FLIGHT',
  TRAIN = 'TRAIN',
  BUS = 'BUS',
  FERRY = 'FERRY',
  DRIVE = 'DRIVE',
  RIDESHARE = 'RIDESHARE',
  OTHER = 'OTHER',
}

export enum TravelGroupStatus {
  FORMING = 'FORMING',
  CONFIRMED = 'CONFIRMED',
  FULL = 'FULL',
  DEPARTED = 'DEPARTED',
  CANCELLED = 'CANCELLED',
}

export enum TravelGroupRole {
  ORGANIZER = 'ORGANIZER',
  MEMBER = 'MEMBER',
}

export enum VisaRequirementLevel {
  NOT_REQUIRED = 'NOT_REQUIRED',
  ON_ARRIVAL = 'ON_ARRIVAL',
  E_VISA = 'E_VISA',
  REQUIRED = 'REQUIRED',
  UNKNOWN = 'UNKNOWN',
}

export enum BorderCrossingDifficulty {
  EASY = 'EASY',
  MODERATE = 'MODERATE',
  COMPLEX = 'COMPLEX',
}

export enum RouteTipCategory {
  TRANSPORT = 'TRANSPORT',
  BORDER = 'BORDER',
  ACCOMMODATION = 'ACCOMMODATION',
  SAFETY = 'SAFETY',
  STADIUM = 'STADIUM',
  GENERAL = 'GENERAL',
}

export enum RouteTipStatus {
  ACTIVE = 'ACTIVE',
  FLAGGED = 'FLAGGED',
  REMOVED = 'REMOVED',
}

// ---------------------------------------------------------------------------
// Core Entities
// ---------------------------------------------------------------------------

export interface CityPair {
  origin_city_id: string;
  destination_city_id: string;
  origin_city_name: string;
  destination_city_name: string;
  origin_country_code: string; // ISO 3166-1 alpha-2
  destination_country_code: string;
}

export interface InterCityRoute {
  route_id: string;
  city_pair: CityPair;
  transport_modes: TransportMode[];
  estimated_duration_minutes: number;
  estimated_cost_usd_min: number | null;
  estimated_cost_usd_max: number | null;
  is_cross_border: boolean;
  visa_requirement: VisaRequirementLevel;
  border_crossing_difficulty: BorderCrossingDifficulty | null;
  border_crossing_notes: string | null;
  active_fan_count: number; // cached from matching engine
  tips_count: number;
  last_tip_at: string | null; // ISO 8601
  created_at: string;
  updated_at: string;
}

export interface RouteTip {
  tip_id: string;
  route_id: string;
  author_user_id: string;
  author_display_name: string;
  author_trust_tier: string;
  category: RouteTipCategory;
  content: string; // max 1000 chars
  transport_mode: TransportMode | null;
  travel_date: string | null; // ISO 8601 date
  upvotes: number;
  downvotes: number;
  viewer_vote: 'UP' | 'DOWN' | null; // contextual, viewer-specific
  status: RouteTipStatus;
  created_at: string;
  updated_at: string;
}

export interface TravelGroup {
  group_id: string;
  route_id: string;
  event_id: string;
  name: string;
  description: string | null;
  transport_mode: TransportMode;
  departure_date: string; // ISO 8601 date
  departure_time: string | null; // HH:MM local time
  departure_location: string | null;
  max_members: number;
  current_members: number;
  status: TravelGroupStatus;
  organizer_user_id: string;
  organizer_display_name: string;
  organizer_trust_tier: string;
  is_private: boolean;
  join_code: string | null; // only for private groups, only shown to members
  member_nationalities: string[]; // ISO 3166-1 alpha-2 codes (anonymized list)
  created_at: string;
  updated_at: string;
}

export interface TravelGroupMember {
  membership_id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  trust_tier: string;
  role: TravelGroupRole;
  joined_at: string;
  nationality_code: string; // ISO 3166-1 alpha-2
}

export interface VisaReminderDismissal {
  dismissal_id: string;
  user_id: string;
  route_id: string;
  dismissed_at: string;
}

export interface BorderVisaInfo {
  route_id: string;
  origin_country_code: string;
  destination_country_code: string;
  visa_requirement: VisaRequirementLevel;
  processing_time_days: number | null;
  e_visa_url: string | null;
  official_source_url: string | null;
  notes: string | null;
  last_verified_at: string;
  disclaimer: string;
}

export interface FanRouteSummary {
  route_id: string;
  city_pair: CityPair;
  fan_count: number; // fans on same route/date
  travel_date: string;
  sample_nationalities: string[]; // up to 3
  community_trip_id: string | null;
}

// ---------------------------------------------------------------------------
// Zod Schemas (for runtime validation)
// ---------------------------------------------------------------------------

export const CreateRouteTipSchema = z.object({
  route_id: z.string().uuid(),
  category: z.nativeEnum(RouteTipCategory),
  content: z
    .string()
    .min(10, 'Tip must be at least 10 characters')
    .max(1000, 'Tip must not exceed 1000 characters')
    .trim(),
  transport_mode: z.nativeEnum(TransportMode).nullable().optional(),
  travel_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO 8601 date YYYY-MM-DD')
    .nullable()
    .optional(),
});
export type CreateRouteTipInput = z.infer<typeof CreateRouteTipSchema>;

export const UpdateRouteTipSchema = z.object({
  category: z.nativeEnum(RouteTipCategory).optional(),
  content: z.string().min(10).max(1000).trim().optional(),
  transport_mode: z.nativeEnum(TransportMode).nullable().optional(),
  travel_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export type UpdateRouteTipInput = z.infer<typeof UpdateRouteTipSchema>;

export const VoteTipSchema = z.object({
  vote: z.enum(['UP', 'DOWN']),
});
export type VoteTipInput = z.infer<typeof VoteTipSchema>;

export const CreateTravelGroupSchema = z.object({
  route_id: z.string().uuid(),
  event_id: z.string().uuid(),
  name: z
    .string()
    .min(3, 'Group name must be at least 3 characters')
    .max(80, 'Group name must not exceed 80 characters')
    .trim(),
  description: z.string().max(500).trim().nullable().optional(),
  transport_mode: z.nativeEnum(TransportMode),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  departure_location: z.string().max(200).trim().nullable().optional(),
  max_members: z
    .number()
    .int()
    .min(2, 'Group must allow at least 2 members')
    .max(100, 'Group cannot exceed 100 members'),
  is_private: z.boolean().default(false),
});
export type CreateTravelGroupInput = z.infer<typeof CreateTravelGroupSchema>;

export const UpdateTravelGroupSchema = CreateTravelGroupSchema.partial().omit({
  route_id: true,
  event_id: true,
});
export type UpdateTravelGroupInput = z.infer<typeof UpdateTravelGroupSchema>;

export const JoinTravelGroupSchema = z.object({
  join_code: z.string().max(20).optional(),
});
export type JoinTravelGroupInput = z.infer<typeof JoinTravelGroupSchema>;

export const ListRoutesQuerySchema = z.object({
  origin_city_id: z.string().optional(),
  destination_city_id: z.string().optional(),
  event_id: z.string().uuid().optional(),
  transport_mode: z.nativeEnum(TransportMode).optional(),
  is_cross_border: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListRoutesQuery = z.infer<typeof ListRoutesQuerySchema>;

export const ListTipsQuerySchema = z.object({
  route_id: z.string().uuid().optional(),
  category: z.nativeEnum(RouteTipCategory).optional(),
  transport_mode: z.nativeEnum(TransportMode).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['newest', 'top_rated']).default('top_rated'),
});
export type ListTipsQuery = z.infer<typeof ListTipsQuerySchema>;

export const ListTravelGroupsQuerySchema = z.object({
  route_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(TravelGroupStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListTravelGroupsQuery = z.infer<typeof ListTravelGroupsQuerySchema>;

// ---------------------------------------------------------------------------
// API Response types
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface RouteWithTipsAndGroups extends InterCityRoute {
  top_tips: RouteTip[];
  active_groups: TravelGroup[];
  visa_info: BorderVisaInfo | null;
  co_travelers: FanRouteSummary | null;
}