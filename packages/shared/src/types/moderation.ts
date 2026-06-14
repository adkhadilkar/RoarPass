import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ModeratorRoleSchema = z.enum([
  'COMMUNITY_MODERATOR',
  'SENIOR_MODERATOR',
  'ADMIN',
]);
export type ModeratorRole = z.infer<typeof ModeratorRoleSchema>;

export const ModerationActionTypeSchema = z.enum([
  'WARN',
  'MUTE',
  'KICK',
  'BAN',
  'UNBAN',
  'REMOVE_CONTENT',
  'RESTORE_CONTENT',
  'PIN_POST',
  'UNPIN_POST',
  'POST_ANNOUNCEMENT',
  'EDIT_ANNOUNCEMENT',
  'DELETE_ANNOUNCEMENT',
  'RESOLVE_REPORT',
  'ESCALATE_REPORT',
  'CLOSE_REPORT',
  'APPROVE_AUTO_MOD',
  'OVERRIDE_AUTO_MOD',
  'UPDATE_MOD_SETTINGS',
]);
export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;

export const ReportReasonSchema = z.enum([
  'SPAM',
  'HATE_SPEECH',
  'HARASSMENT',
  'MISINFORMATION',
  'VIOLENCE',
  'INAPPROPRIATE_CONTENT',
  'DOXXING',
  'SCAM',
  'OTHER',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportStatusSchema = z.enum([
  'PENDING',
  'UNDER_REVIEW',
  'RESOLVED_ACTION_TAKEN',
  'RESOLVED_NO_ACTION',
  'ESCALATED',
  'CLOSED',
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ContentTypeSchema = z.enum([
  'MESSAGE',
  'POST',
  'COMMENT',
  'PROFILE',
  'MEDIA',
  'ANNOUNCEMENT',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const AutoModActionSchema = z.enum([
  'NONE',
  'FLAG',
  'SHADOW_REMOVE',
  'HARD_REMOVE',
  'RATE_LIMIT',
]);
export type AutoModAction = z.infer<typeof AutoModActionSchema>;

export const AnnouncementPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);
export type AnnouncementPriority = z.infer<typeof AnnouncementPrioritySchema>;

// ─── Core Entities ────────────────────────────────────────────────────────────

export const CommunityModeratorSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ModeratorRoleSchema,
  assignedBy: z.string().uuid(),
  assignedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  permissions: z.array(z.string()),
});
export type CommunityModerator = z.infer<typeof CommunityModeratorSchema>;

export const ContentReportSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetContentId: z.string().uuid(),
  targetContentType: ContentTypeSchema,
  targetUserId: z.string().uuid().nullable(),
  reason: ReportReasonSchema,
  details: z.string().max(1000).nullable(),
  status: ReportStatusSchema,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  assignedModeratorId: z.string().uuid().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionNotes: z.string().max(2000).nullable(),
  slaDeadline: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ContentReport = z.infer<typeof ContentReportSchema>;

export const ModerationAuditLogSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  moderatorId: z.string().uuid(),
  actionType: ModerationActionTypeSchema,
  targetUserId: z.string().uuid().nullable(),
  targetContentId: z.string().uuid().nullable(),
  targetContentType: ContentTypeSchema.nullable(),
  reportId: z.string().uuid().nullable(),
  reason: z.string().max(2000).nullable(),
  metadata: z.record(z.unknown()),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ModerationAuditLog = z.infer<typeof ModerationAuditLogSchema>;

export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  priority: AnnouncementPrioritySchema,
  isPinned: z.boolean(),
  isOfficial: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  editHistory: z.array(
    z.object({
      editedBy: z.string().uuid(),
      editedAt: z.string().datetime(),
      previousBody: z.string(),
    }),
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const PinnedGuideSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  category: z.string().max(100),
  order: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PinnedGuide = z.infer<typeof PinnedGuideSchema>;

export const UserBlockSchema = z.object({
  id: z.string().uuid(),
  blockerId: z.string().uuid(),
  blockedUserId: z.string().uuid(),
  reason: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
});
export type UserBlock = z.infer<typeof UserBlockSchema>;

export const AutoModRuleSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid().nullable(), // null = global
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  pattern: z.string().max(1000),
  patternType: z.enum(['REGEX', 'KEYWORD', 'ML_CLASSIFIER']),
  action: AutoModActionSchema,
  threshold: z.number().min(0).max(1).nullable(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  updatedAt: z.string().datetime(),
});
export type AutoModRule = z.infer<typeof AutoModRuleSchema>;

export const ModerationSettingsSchema = z.object({
  communityId: z.string().uuid(),
  slowModeSeconds: z.number().int().min(0).max(3600),
  requireAccountAge: z.number().int().min(0), // days
  requireVerification: z.boolean(),
  autoModEnabled: z.boolean(),
  reportSlaHours: z.number().int().min(1).max(168), // 1hr–7d
  escalateSlaHours: z.number().int().min(1).max(48),
  allowMemberReports: z.boolean(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().uuid(),
});
export type ModerationSettings = z.infer<typeof ModerationSettingsSchema>;

// ─── API Request / Response types ─────────────────────────────────────────────

export const CreateReportRequestSchema = z.object({
  targetContentId: z.string().uuid(),
  targetContentType: ContentTypeSchema,
  targetUserId: z.string().uuid().optional(),
  reason: ReportReasonSchema,
  details: z.string().max(1000).optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

export const ResolveReportRequestSchema = z.object({
  status: z.enum([
    'RESOLVED_ACTION_TAKEN',
    'RESOLVED_NO_ACTION',
    'ESCALATED',
    'CLOSED',
  ]),
  resolutionNotes: z.string().max(2000).optional(),
  actionType: ModerationActionTypeSchema.optional(),
});
export type ResolveReportRequest = z.infer<typeof ResolveReportRequestSchema>;

export const CreateAnnouncementRequestSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  priority: AnnouncementPrioritySchema.optional().default('NORMAL'),
  isPinned: z.boolean().optional().default(false),
  isOfficial: z.boolean().optional().default(false),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateAnnouncementRequest = z.infer<
  typeof CreateAnnouncementRequestSchema
>;

export const ModerationActionRequestSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetContentId: z.string().uuid().optional(),
  targetContentType: ContentTypeSchema.optional(),
  actionType: ModerationActionTypeSchema,
  reason: z.string().min(1).max(2000),
  durationSeconds: z.number().int().min(1).optional(), // for MUTE/BAN
  reportId: z.string().uuid().optional(),
});
export type ModerationActionRequest = z.infer<
  typeof ModerationActionRequestSchema
>;

export const AssignModeratorRequestSchema = z.object({
  userId: z.string().uuid(),
  role: ModeratorRoleSchema,
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});
export type AssignModeratorRequest = z.infer<
  typeof AssignModeratorRequestSchema
>;

export const ModerationQueueFiltersSchema = z.object({
  status: ReportStatusSchema.optional(),
  reason: ReportReasonSchema.optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  assignedToMe: z.boolean().optional(),
  communityId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(25),
});
export type ModerationQueueFilters = z.infer<
  typeof ModerationQueueFiltersSchema
>;

export const ModerationQueuePageSchema = z.object({
  items: z.array(ContentReportSchema),
  nextCursor: z.string().nullable(),
  totalPending: z.number().int(),
  overdueCount: z.number().int(),
});
export type ModerationQueuePage = z.infer<typeof ModerationQueuePageSchema>;