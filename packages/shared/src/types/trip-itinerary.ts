import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const TripItemTypeSchema = z.enum([
  'FLIGHT',
  'GROUND_TRANSFER',
  'ACCOMMODATION',
  'MATCH_SESSION',
  'MEETUP',
  'FREE_TIME',
  'ACTIVITY',
]);
export type TripItemType = z.infer<typeof TripItemTypeSchema>;

export const TripVisibilitySchema = z.enum(['PRIVATE', 'GROUP', 'PUBLIC']);
export type TripVisibility = z.infer<typeof TripVisibilitySchema>;

export const TripRoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type TripRole = z.infer<typeof TripRoleSchema>;

export const VoteOptionSchema = z.enum(['YES', 'NO', 'MAYBE']);
export type VoteOption = z.infer<typeof VoteOptionSchema>;

export const ExportFormatSchema = z.enum(['ICAL', 'GOOGLE_CALENDAR', 'PDF']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

// ---------------------------------------------------------------------------
// Trip Item
// ---------------------------------------------------------------------------

export const TripItemSchema = z.object({
  item_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  type: TripItemTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  location_name: z.string().max(300).nullable().optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  /** ISO 8601 datetime with timezone offset */
  start_time: z.string().datetime({ offset: true }),
  /** ISO 8601 datetime with timezone offset */
  end_time: z.string().datetime({ offset: true }).nullable().optional(),
  /** IANA timezone identifier e.g. "America/Chicago" */
  timezone: z.string().min(1).max(100),
  /** FK → Event (event-registry) — optional link */
  event_id: z.string().uuid().nullable().optional(),
  /** FK → Match in event-registry */
  match_id: z.string().uuid().nullable().optional(),
  /** Arbitrary key-value metadata (flight number, booking ref, etc.) */
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
});
export type TripItem = z.infer<typeof TripItemSchema>;

export const CreateTripItemSchema = TripItemSchema.omit({
  item_id: true,
  trip_id: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  is_deleted: true,
});
export type CreateTripItemInput = z.infer<typeof CreateTripItemSchema>;

export const UpdateTripItemSchema = CreateTripItemSchema.partial();
export type UpdateTripItemInput = z.infer<typeof UpdateTripItemSchema>;

// ---------------------------------------------------------------------------
// Personal Trip (Itinerary)
// ---------------------------------------------------------------------------

export const TripSchema = z.object({
  trip_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  /** FK → Event (event-registry) */
  event_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  visibility: TripVisibilitySchema.default('PRIVATE'),
  cover_image_url: z.string().url().nullable().optional(),
  /** IANA timezone for display defaults */
  home_timezone: z.string().min(1).max(100),
  /** ISO 8601 date */
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** ISO 8601 date */
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_group_trip: z.boolean().default(false),
  /** If group trip, FK → CommunityTrip */
  community_trip_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
});
export type Trip = z.infer<typeof TripSchema>;

export const CreateTripSchema = TripSchema.omit({
  trip_id: true,
  owner_id: true,
  created_at: true,
  updated_at: true,
  is_deleted: true,
  community_trip_id: true,
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;

export const UpdateTripSchema = CreateTripSchema.partial();
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;

// ---------------------------------------------------------------------------
// Trip Member (group trips)
// ---------------------------------------------------------------------------

export const TripMemberSchema = z.object({
  member_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: TripRoleSchema,
  joined_at: z.string().datetime(),
  invited_by: z.string().uuid().nullable().optional(),
});
export type TripMember = z.infer<typeof TripMemberSchema>;

export const InviteTripMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['EDITOR', 'VIEWER']),
});
export type InviteTripMemberInput = z.infer<typeof InviteTripMemberSchema>;

// ---------------------------------------------------------------------------
// Community Trip (shared group itinerary)
// ---------------------------------------------------------------------------

export const CommunityTripSchema = z.object({
  community_trip_id: z.string().uuid(),
  /** FK → Country/City Community */
  community_id: z.string().uuid(),
  /** FK → Event (event-registry) */
  event_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  max_participants: z.number().int().min(2).max(500).nullable().optional(),
  participant_count: z.number().int().min(0).default(0),
  is_open: z.boolean().default(true),
  /** IANA timezone */
  home_timezone: z.string().min(1).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Chat channel ID from messaging-realtime */
  chat_channel_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
});
export type CommunityTrip = z.infer<typeof CommunityTripSchema>;

export const CreateCommunityTripSchema = CommunityTripSchema.omit({
  community_trip_id: true,
  owner_id: true,
  participant_count: true,
  created_at: true,
  updated_at: true,
  is_deleted: true,
  chat_channel_id: true,
});
export type CreateCommunityTripInput = z.infer<typeof CreateCommunityTripSchema>;

// ---------------------------------------------------------------------------
// Community Trip Member
// ---------------------------------------------------------------------------

export const CommunityTripMemberSchema = z.object({
  member_id: z.string().uuid(),
  community_trip_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: TripRoleSchema,
  joined_at: z.string().datetime(),
});
export type CommunityTripMember = z.infer<typeof CommunityTripMemberSchema>;

// ---------------------------------------------------------------------------
// Itinerary Vote (for group decisions)
// ---------------------------------------------------------------------------

export const ItineraryVoteProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  /** Could be an existing item_id being voted on, or a proposed new item */
  proposed_item: TripItemSchema.partial().extend({
    title: z.string().min(1).max(200),
    start_time: z.string().datetime({ offset: true }),
  }),
  proposed_by: z.string().uuid(),
  question: z.string().min(1).max(500),
  /** ISO 8601 datetime when voting closes */
  closes_at: z.string().datetime({ offset: true }),
  yes_count: z.number().int().default(0),
  no_count: z.number().int().default(0),
  maybe_count: z.number().int().default(0),
  is_resolved: z.boolean().default(false),
  resolution: z.enum(['APPROVED', 'REJECTED', 'EXPIRED']).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type ItineraryVoteProposal = z.infer<typeof ItineraryVoteProposalSchema>;

export const CreateVoteProposalSchema = ItineraryVoteProposalSchema.omit({
  proposal_id: true,
  proposed_by: true,
  yes_count: true,
  no_count: true,
  maybe_count: true,
  is_resolved: true,
  resolution: true,
  created_at: true,
  updated_at: true,
});
export type CreateVoteProposalInput = z.infer<typeof CreateVoteProposalSchema>;

export const CastVoteSchema = z.object({
  vote: VoteOptionSchema,
  comment: z.string().max(500).nullable().optional(),
});
export type CastVoteInput = z.infer<typeof CastVoteSchema>;

export const VoteCastSchema = z.object({
  vote_id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  user_id: z.string().uuid(),
  vote: VoteOptionSchema,
  comment: z.string().max(500).nullable().optional(),
  created_at: z.string().datetime(),
});
export type VoteCast = z.infer<typeof VoteCastSchema>;

// ---------------------------------------------------------------------------
// Calendar Export
// ---------------------------------------------------------------------------

export const ExportRequestSchema = z.object({
  format: ExportFormatSchema,
  trip_id: z.string().uuid(),
  include_item_types: z.array(TripItemTypeSchema).optional(),
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

// ---------------------------------------------------------------------------
// Offline Sync
// ---------------------------------------------------------------------------

export const OfflineSyncManifestSchema = z.object({
  trip_id: z.string().uuid(),
  last_synced_at: z.string().datetime(),
  item_count: z.number().int(),
  checksum: z.string(),
});
export type OfflineSyncManifest = z.infer<typeof OfflineSyncManifestSchema>;

// ---------------------------------------------------------------------------
// API Response wrappers
// ---------------------------------------------------------------------------

export const TripWithItemsSchema = TripSchema.extend({
  items: z.array(TripItemSchema),
  members: z.array(TripMemberSchema).optional(),
});
export type TripWithItems = z.infer<typeof TripWithItemsSchema>;

export const CommunityTripWithItemsSchema = CommunityTripSchema.extend({
  items: z.array(TripItemSchema),
  members: z.array(CommunityTripMemberSchema),
  pending_proposals: z.array(ItineraryVoteProposalSchema).optional(),
});
export type CommunityTripWithItems = z.infer<typeof CommunityTripWithItemsSchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const PaginatedTripsSchema = z.object({
  trips: z.array(TripSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
});
export type PaginatedTrips = z.infer<typeof PaginatedTripsSchema>;