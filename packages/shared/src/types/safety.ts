import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SafetyMode {
  STANDARD = 'STANDARD',
  SOLO = 'SOLO',
  WOMEN = 'WOMEN',
  FAMILY = 'FAMILY',
  ACCESSIBILITY = 'ACCESSIBILITY',
}

export enum SOSStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export enum CheckInStatus {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum LocationSharingMode {
  DISABLED = 'DISABLED',
  TRUSTED_ONLY = 'TRUSTED_ONLY',
  GROUP = 'GROUP',
}

export enum TrustedContactRole {
  EMERGENCY_CONTACT = 'EMERGENCY_CONTACT',
  TRAVEL_BUDDY = 'TRAVEL_BUDDY',
  FAMILY = 'FAMILY',
}

export enum ReportCategory {
  HARASSMENT = 'HARASSMENT',
  FRAUD = 'FRAUD',
  FAKE_PROFILE = 'FAKE_PROFILE',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  SAFETY_THREAT = 'SAFETY_THREAT',
  OTHER = 'OTHER',
}

export enum BlockStatus {
  ACTIVE = 'ACTIVE',
  LIFTED = 'LIFTED',
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const SafetyPreferencesSchema = z.object({
  user_id: z.string().uuid(),
  active_mode: z.nativeEnum(SafetyMode).default(SafetyMode.STANDARD),
  location_sharing_mode: z.nativeEnum(LocationSharingMode).default(LocationSharingMode.DISABLED),
  check_in_interval_minutes: z.number().int().min(15).max(1440).default(60),
  auto_sos_on_overdue: z.boolean().default(false),
  sos_message_custom: z.string().max(500).nullable().optional(),
  updated_at: z.string().datetime(),
});

export const TrustedContactSchema = z.object({
  contact_id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  contact_user_id: z.string().uuid().nullable().optional(), // null if external
  contact_name: z.string().min(1).max(100),
  contact_phone: z.string().max(20).nullable().optional(),
  contact_email: z.string().email().max(255).nullable().optional(),
  role: z.nativeEnum(TrustedContactRole),
  confirmed: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const MeetupCheckInSchema = z.object({
  checkin_id: z.string().uuid(),
  meetup_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.nativeEnum(CheckInStatus),
  checked_in_at: z.string().datetime().nullable().optional(),
  checked_out_at: z.string().datetime().nullable().optional(),
  expected_checkout_at: z.string().datetime().nullable().optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SOSAlertSchema = z.object({
  sos_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.nativeEnum(SOSStatus),
  triggered_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable().optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  location_accuracy_meters: z.number().positive().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  notified_contact_ids: z.array(z.string().uuid()).default([]),
  event_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const LocationShareSchema = z.object({
  share_id: z.string().uuid(),
  sharer_user_id: z.string().uuid(),
  recipient_user_id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  expires_at: z.string().datetime(),
  revoked: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const UserReportSchema = z.object({
  report_id: z.string().uuid(),
  reporter_user_id: z.string().uuid(),
  reported_user_id: z.string().uuid(),
  category: z.nativeEnum(ReportCategory),
  description: z.string().min(10).max(2000),
  evidence_urls: z.array(z.string().url()).max(5).default([]),
  reviewed: z.boolean().default(false),
  reviewer_id: z.string().uuid().nullable().optional(),
  review_notes: z.string().max(2000).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const BlockRecordSchema = z.object({
  block_id: z.string().uuid(),
  blocker_user_id: z.string().uuid(),
  blocked_user_id: z.string().uuid(),
  status: z.nativeEnum(BlockStatus),
  reason: z.string().max(500).nullable().optional(),
  created_at: z.string().datetime(),
  lifted_at: z.string().datetime().nullable().optional(),
});

// ─── Request / Response DTOs ──────────────────────────────────────────────────

export const UpdateSafetyPreferencesRequestSchema = z.object({
  active_mode: z.nativeEnum(SafetyMode).optional(),
  location_sharing_mode: z.nativeEnum(LocationSharingMode).optional(),
  check_in_interval_minutes: z.number().int().min(15).max(1440).optional(),
  auto_sos_on_overdue: z.boolean().optional(),
  sos_message_custom: z.string().max(500).nullable().optional(),
});

export const CreateTrustedContactRequestSchema = z.object({
  contact_user_id: z.string().uuid().nullable().optional(),
  contact_name: z.string().min(1).max(100),
  contact_phone: z.string().max(20).nullable().optional(),
  contact_email: z.string().email().max(255).nullable().optional(),
  role: z.nativeEnum(TrustedContactRole),
});

export const MeetupCheckInRequestSchema = z.object({
  meetup_id: z.string().uuid(),
  expected_checkout_at: z.string().datetime().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
});

export const MeetupCheckOutRequestSchema = z.object({
  meetup_id: z.string().uuid(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
});

export const TriggerSOSRequestSchema = z.object({
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_accuracy_meters: z.number().positive().optional(),
  message: z.string().max(500).optional(),
  event_id: z.string().uuid().optional(),
});

export const ResolveSOSRequestSchema = z.object({
  resolution_note: z.string().max(500).optional(),
});

export const CreateLocationShareRequestSchema = z.object({
  recipient_user_id: z.string().uuid(),
  event_id: z.string().uuid().optional(),
  duration_minutes: z.number().int().min(5).max(1440).default(60),
});

export const CreateUserReportRequestSchema = z.object({
  reported_user_id: z.string().uuid(),
  category: z.nativeEnum(ReportCategory),
  description: z.string().min(10).max(2000),
  evidence_urls: z.array(z.string().url()).max(5).default([]),
});

export const CreateBlockRequestSchema = z.object({
  blocked_user_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type SafetyPreferences = z.infer<typeof SafetyPreferencesSchema>;
export type TrustedContact = z.infer<typeof TrustedContactSchema>;
export type MeetupCheckIn = z.infer<typeof MeetupCheckInSchema>;
export type SOSAlert = z.infer<typeof SOSAlertSchema>;
export type LocationShare = z.infer<typeof LocationShareSchema>;
export type UserReport = z.infer<typeof UserReportSchema>;
export type BlockRecord = z.infer<typeof BlockRecordSchema>;

export type UpdateSafetyPreferencesRequest = z.infer<typeof UpdateSafetyPreferencesRequestSchema>;
export type CreateTrustedContactRequest = z.infer<typeof CreateTrustedContactRequestSchema>;
export type MeetupCheckInRequest = z.infer<typeof MeetupCheckInRequestSchema>;
export type MeetupCheckOutRequest = z.infer<typeof MeetupCheckOutRequestSchema>;
export type TriggerSOSRequest = z.infer<typeof TriggerSOSRequestSchema>;
export type ResolveSOSRequest = z.infer<typeof ResolveSOSRequestSchema>;
export type CreateLocationShareRequest = z.infer<typeof CreateLocationShareRequestSchema>;
export type CreateUserReportRequest = z.infer<typeof CreateUserReportRequestSchema>;
export type CreateBlockRequest = z.infer<typeof CreateBlockRequestSchema>;

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface SafetyPreferencesResponse {
  preferences: SafetyPreferences;
}

export interface TrustedContactListResponse {
  contacts: TrustedContact[];
  total: number;
}

export interface SOSAlertResponse {
  sos: SOSAlert;
}

export interface CheckInStatusResponse {
  checkin: MeetupCheckIn;
}

export interface LocationShareResponse {
  share: LocationShare;
}

export interface UserReportResponse {
  report: UserReport;
}

export interface BlockRecordResponse {
  block: BlockRecord;
}