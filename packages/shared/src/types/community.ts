/**
 * Shared TypeScript contracts for Country & City Communities
 * Chunk: country-communities | PRD refs: 5.2, 7.3.1, 7.3.2, 7.3.3
 */

export type CommunityType =
  | 'COUNTRY'
  | 'CITY'
  | 'AFFINITY'
  | 'CROSS_COUNTRY';

export type ChannelType =
  | 'GENERAL'
  | 'MATCH_DAY'
  | 'TRAVEL_TIPS'
  | 'MEETUPS'
  | 'OFFICIAL_ANNOUNCEMENTS'
  | 'HELP_REQUESTS';

export type MemberRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';

export type CommunityVisibility = 'PUBLIC' | 'PRIVATE' | 'EVENT_ONLY';

export type JoinStatus = 'NONE' | 'PENDING' | 'MEMBER' | 'BANNED';

export interface Community {
  community_id: string;
  event_id: string;
  type: CommunityType;
  name: string;
  slug: string;
  description: string | null;
  country_code: string | null;     // ISO 3166-1 alpha-2 for COUNTRY/CITY types
  city_id: string | null;          // FK → HostCity for CITY type
  parent_community_id: string | null; // For CITY sub-communities
  affinity_tags: string[];         // For AFFINITY/CROSS_COUNTRY types
  visibility: CommunityVisibility;
  community_default_language: string | null; // ISO 639-1; used by translation-layer
  member_count: number;
  banner_image_url: string | null;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityChannel {
  channel_id: string;
  community_id: string;
  type: ChannelType;
  name: string;
  slug: string;
  description: string | null;
  community_default_language: string | null; // ISO 639-1; consumed by translation-layer
  is_readonly: boolean;             // e.g. official announcement channels
  is_pinned: boolean;
  sort_order: number;
  message_count: number;
  last_message_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  membership_id: string;
  community_id: string;
  user_id: string;
  role: MemberRole;
  join_status: JoinStatus;
  joined_at: string;
  updated_at: string;
}

export interface CommunityMemberProfile {
  membership_id: string;
  community_id: string;
  user_id: string;
  role: MemberRole;
  join_status: JoinStatus;
  joined_at: string;
  // Denormalized from Fan Profile for display
  display_name: string;
  avatar_url: string | null;
  country_code: string | null;
  verification_tier: string;
  languages_spoken: string[];
}

export interface CommunitySummary {
  community_id: string;
  event_id: string;
  type: CommunityType;
  name: string;
  slug: string;
  country_code: string | null;
  city_id: string | null;
  parent_community_id: string | null;
  member_count: number;
  banner_image_url: string | null;
  icon_url: string | null;
  join_status: JoinStatus; // viewer's status
  child_communities?: CommunitySummary[]; // city sub-communities
}

export interface AffinityTag {
  tag_id: string;
  slug: string;
  label: string; // i18n key or display label
  description: string | null;
}

// ─── Request / Response DTOs ─────────────────────────────────────────────────

export interface CreateCommunityDto {
  event_id: string;
  type: CommunityType;
  name: string;
  slug: string;
  description?: string;
  country_code?: string;
  city_id?: string;
  parent_community_id?: string;
  affinity_tags?: string[];
  visibility?: CommunityVisibility;
  community_default_language?: string;
  banner_image_url?: string;
  icon_url?: string;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  affinity_tags?: string[];
  visibility?: CommunityVisibility;
  community_default_language?: string;
  banner_image_url?: string;
  icon_url?: string;
  is_active?: boolean;
}

export interface CreateChannelDto {
  community_id: string;
  type: ChannelType;
  name: string;
  slug: string;
  description?: string;
  community_default_language?: string;
  is_readonly?: boolean;
  is_pinned?: boolean;
  sort_order?: number;
}

export interface UpdateChannelDto {
  name?: string;
  description?: string;
  community_default_language?: string;
  is_readonly?: boolean;
  is_pinned?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface JoinCommunityDto {
  community_id: string;
}

export interface ListCommunitiesQuery {
  event_id: string;
  type?: CommunityType;
  country_code?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}