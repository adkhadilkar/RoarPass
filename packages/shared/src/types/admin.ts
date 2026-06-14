import { z } from 'zod';

// ─── Admin Role & Permission Types ───────────────────────────────────────────

export const AdminRoleSchema = z.enum([
  'SUPER_ADMIN',
  'EVENT_ADMIN',
  'COMMUNITY_ADMIN',
  'SUPPORT_AGENT',
  'ANALYTICS_VIEWER',
  'TRUST_SAFETY',
  'READ_ONLY',
]);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const AdminPermissionSchema = z.enum([
  // Event management
  'events:read',
  'events:write',
  'events:delete',
  // Community management
  'communities:read',
  'communities:write',
  'communities:moderate',
  // User management
  'users:read',
  'users:write',
  'users:suspend',
  'users:delete',
  // Trust & safety
  'trust:read',
  'trust:write',
  'trust:verify',
  // Analytics
  'analytics:read',
  'analytics:export',
  // Helper network
  'helpers:read',
  'helpers:write',
  'helpers:verify',
  // Business partners
  'partners:read',
  'partners:write',
  // Phrase cards / translation
  'phrase_cards:read',
  'phrase_cards:write',
  // Admin user management (SUPER_ADMIN only)
  'admin_users:read',
  'admin_users:write',
  // Incident management
  'incidents:read',
  'incidents:write',
  // Audit logs
  'audit:read',
]);
export type AdminPermission = z.infer<typeof AdminPermissionSchema>;

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    'events:read', 'events:write', 'events:delete',
    'communities:read', 'communities:write', 'communities:moderate',
    'users:read', 'users:write', 'users:suspend', 'users:delete',
    'trust:read', 'trust:write', 'trust:verify',
    'analytics:read', 'analytics:export',
    'helpers:read', 'helpers:write', 'helpers:verify',
    'partners:read', 'partners:write',
    'phrase_cards:read', 'phrase_cards:write',
    'admin_users:read', 'admin_users:write',
    'incidents:read', 'incidents:write',
    'audit:read',
  ],
  EVENT_ADMIN: [
    'events:read', 'events:write',
    'communities:read', 'communities:write',
    'analytics:read',
    'helpers:read', 'helpers:write',
    'partners:read',
    'phrase_cards:read', 'phrase_cards:write',
    'incidents:read', 'incidents:write',
  ],
  COMMUNITY_ADMIN: [
    'communities:read', 'communities:write', 'communities:moderate',
    'users:read',
    'analytics:read',
    'incidents:read', 'incidents:write',
  ],
  SUPPORT_AGENT: [
    'users:read', 'users:suspend',
    'communities:read',
    'incidents:read', 'incidents:write',
    'trust:read',
    'helpers:read',
    'analytics:read',
  ],
  ANALYTICS_VIEWER: [
    'analytics:read',
    'analytics:export',
    'events:read',
    'communities:read',
  ],
  TRUST_SAFETY: [
    'trust:read', 'trust:write', 'trust:verify',
    'users:read', 'users:suspend',
    'incidents:read', 'incidents:write',
    'communities:read', 'communities:moderate',
    'analytics:read',
    'audit:read',
  ],
  READ_ONLY: [
    'events:read',
    'communities:read',
    'users:read',
    'analytics:read',
    'helpers:read',
    'partners:read',
    'incidents:read',
  ],
};

// ─── Admin User ───────────────────────────────────────────────────────────────

export interface AdminUser {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

// Strictly no PII in analytics exports — all identifiers are anonymized counts

export interface UsageMetrics {
  period: string; // ISO 8601 date or interval
  activeUsers: number; // count only, no IDs
  newRegistrations: number;
  eventActivations: number;
  communityJoins: number;
  messagesExchanged: number;
  translationRequests: number;
  helperSessionsBooked: number;
  sosActivations: number;
  retentionRate7d: number; // percentage
  retentionRate30d: number; // percentage
}

export interface TripMetrics {
  period: string;
  tripsCreated: number;
  tripsCompleted: number;
  intercityRouteSearches: number;
  popularRoutes: Array<{
    routeLabel: string; // e.g., "City A → City B" — no user IDs
    count: number;
  }>;
  averageItineraryItems: number;
}

export interface HelperMetrics {
  period: string;
  activeHelpers: number;
  newHelperApplications: number;
  approvedHelpers: number;
  rejectedHelpers: number;
  helperSessionsTotal: number;
  helperSessionsCompleted: number;
  helperSessionsCancelled: number;
  averageRating: number;
  helpersByCity: Array<{
    cityName: string;
    activeCount: number;
  }>;
}

export interface IncidentMetrics {
  period: string;
  totalReports: number;
  resolvedReports: number;
  openReports: number;
  averageResolutionHours: number;
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  bySeverity: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
  }>;
}

export interface RetentionCohort {
  cohortMonth: string; // e.g., "2026-01"
  cohortSize: number;
  retentionByWeek: number[]; // index = week offset, value = count retained
}

export interface CommunityMetrics {
  period: string;
  activeCommunities: number;
  newCommunities: number;
  postsCreated: number;
  moderationActions: number;
  membersByCountry: Array<{
    countryCode: string;
    count: number;
  }>;
}

export interface AnalyticsDashboardSummary {
  generatedAt: string;
  period: { from: string; to: string };
  usage: UsageMetrics;
  trips: TripMetrics;
  helpers: HelperMetrics;
  incidents: IncidentMetrics;
  community: CommunityMetrics;
}

// ─── Event Management ─────────────────────────────────────────────────────────

export const AdminEventStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
]);
export type AdminEventStatus = z.infer<typeof AdminEventStatusSchema>;

export interface AdminEventRecord {
  eventId: string;
  name: string;
  sport: string;
  hostCities: string[];
  startDate: string;
  endDate: string;
  status: AdminEventStatus;
  registeredFans: number; // aggregate count, no PII
  activeHelpers: number;
  partnerCount: number;
  phraseCardsReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export const UpdateEventStatusSchema = z.object({
  status: AdminEventStatusSchema,
  reason: z.string().min(1).max(500),
});

// ─── User Management ──────────────────────────────────────────────────────────

// Minimal fan record for admin — no sensitive PII exposed in list views
export interface AdminFanSummary {
  userId: string; // internal UUID only
  displayName: string;
  verificationTier: string;
  accountStatus: 'active' | 'suspended' | 'pending_review' | 'deleted';
  registeredAt: string;
  lastActiveAt: string | null;
  reportCount: number;
  // Deliberately excludes: email, phone, passport, full name, location history
}

export const UserActionSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'require_reverification', 'flag_for_review']),
  reason: z.string().min(1).max(1000),
  durationDays: z.number().int().min(1).max(365).optional(), // for suspensions
});

// ─── Trust & Verification ─────────────────────────────────────────────────────

export interface TrustReviewItem {
  reviewId: string;
  userId: string;
  displayName: string;
  currentTier: string;
  requestedTier: string;
  submittedAt: string;
  documents: Array<{
    docType: string;
    submittedAt: string;
    // URLs are signed/short-lived; no raw PII stored in this type
    reviewUrl: string;
  }>;
  adminNotes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'more_info_required';
}

export const TrustDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_more_info']),
  notes: z.string().min(1).max(2000),
  newTier: z.string().optional(),
});

// ─── Community Management ─────────────────────────────────────────────────────

export interface AdminCommunityRecord {
  communityId: string;
  name: string;
  countryCode: string;
  memberCount: number;
  moderatorCount: number;
  status: 'active' | 'restricted' | 'suspended';
  openReports: number;
  createdAt: string;
}

export const CommunityActionSchema = z.object({
  action: z.enum(['restrict', 'unrestrict', 'suspend', 'unsuspend', 'assign_moderator']),
  reason: z.string().min(1).max(500),
  targetUserId: z.string().uuid().optional(), // for assign_moderator
});

// ─── Incident Management ──────────────────────────────────────────────────────

export interface IncidentRecord {
  incidentId: string;
  reportedAt: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reporterDisplayName: string; // not email/full name
  targetType: 'user' | 'community' | 'content' | 'helper';
  targetId: string;
  description: string;
  assignedTo: string | null; // admin display name only
  resolvedAt: string | null;
  resolution: string | null;
}

export const IncidentUpdateSchema = z.object({
  status: z.enum(['investigating', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().uuid().optional(),
  resolution: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  auditId: string;
  adminUserId: string;
  adminDisplayName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  ipAddress: string; // for audit only, not exposed to analytics
  userAgent: string;
  performedAt: string;
}

// ─── Analytics Query Params ───────────────────────────────────────────────────

export const AnalyticsPeriodSchema = z.enum([
  'last_7d',
  'last_30d',
  'last_90d',
  'last_12m',
  'custom',
]);

export const AnalyticsQuerySchema = z.object({
  period: AnalyticsPeriodSchema,
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  eventId: z.string().uuid().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
}).refine(
  (d) => d.period !== 'custom' || (d.from != null && d.to != null),
  { message: 'from and to required for custom period' },
);
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}