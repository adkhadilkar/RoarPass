import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const NotificationChannelEnum = z.enum(['push', 'sms', 'email', 'in_app']);
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

export const NotificationCategoryEnum = z.enum([
  'match_update',
  'trip_update',
  'helper_update',
  'meetup_update',
  'community_announcement',
  'safety_alert',
  'visa_alert',
  'system',
]);
export type NotificationCategory = z.infer<typeof NotificationCategoryEnum>;

export const NotificationPriorityEnum = z.enum(['low', 'normal', 'high', 'critical']);
export type NotificationPriority = z.infer<typeof NotificationPriorityEnum>;

export const NotificationStatusEnum = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
  'expired',
]);
export type NotificationStatus = z.infer<typeof NotificationStatusEnum>;

export const DeliveryStatusEnum = z.enum(['pending', 'sent', 'delivered', 'failed', 'bounced']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusEnum>;

// ─── Core Notification Schema ─────────────────────────────────────────────────

export const NotificationSchema = z.object({
  notification_id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid().optional(),
  category: NotificationCategoryEnum,
  priority: NotificationPriorityEnum,
  title: z.string().max(200),
  body: z.string().max(2000),
  image_url: z.string().url().optional(),
  deep_link: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  is_read: z.boolean().default(false),
  read_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  status: NotificationStatusEnum,
  channels_sent: z.array(NotificationChannelEnum).default([]),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ─── Subscription Preference Schema ──────────────────────────────────────────

export const NotificationTopicEnum = z.enum([
  'match_kickoff_reminder',
  'match_result',
  'match_lineup',
  'match_goal_alert',
  'trip_booking_confirmed',
  'trip_upcoming_reminder',
  'trip_cancellation',
  'trip_change_alert',
  'helper_request_accepted',
  'helper_request_declined',
  'helper_new_message',
  'meetup_invitation',
  'meetup_reminder',
  'meetup_cancellation',
  'meetup_update',
  'community_announcement',
  'community_pin',
  'safety_alert',
  'visa_alert',
  'travel_advisory',
  'system_update',
]);
export type NotificationTopic = z.infer<typeof NotificationTopicEnum>;

export const ChannelPreferenceSchema = z.object({
  push: z.boolean().default(true),
  sms: z.boolean().default(false),
  email: z.boolean().default(true),
  in_app: z.boolean().default(true),
});
export type ChannelPreference = z.infer<typeof ChannelPreferenceSchema>;

export const TopicSubscriptionSchema = z.object({
  topic: NotificationTopicEnum,
  enabled: z.boolean(),
  channels: ChannelPreferenceSchema,
});
export type TopicSubscription = z.infer<typeof TopicSubscriptionSchema>;

export const NotificationPreferencesSchema = z.object({
  user_id: z.string().uuid(),
  global_enabled: z.boolean().default(true),
  quiet_hours_enabled: z.boolean().default(false),
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // HH:MM
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),   // HH:MM
  timezone: z.string().default('UTC'),
  topic_subscriptions: z.array(TopicSubscriptionSchema),
  updated_at: z.string().datetime(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

// ─── Device Push Token ────────────────────────────────────────────────────────

export const PushProviderEnum = z.enum(['fcm', 'apns', 'web_push']);
export type PushProvider = z.infer<typeof PushProviderEnum>;

export const DevicePushTokenSchema = z.object({
  token_id: z.string().uuid(),
  user_id: z.string().uuid(),
  device_id: z.string(),
  provider: PushProviderEnum,
  token: z.string().min(10),
  is_active: z.boolean().default(true),
  registered_at: z.string().datetime(),
  last_used_at: z.string().datetime().optional(),
});
export type DevicePushToken = z.infer<typeof DevicePushTokenSchema>;

// ─── Delivery Record ──────────────────────────────────────────────────────────

export const NotificationDeliverySchema = z.object({
  delivery_id: z.string().uuid(),
  notification_id: z.string().uuid(),
  user_id: z.string().uuid(),
  channel: NotificationChannelEnum,
  status: DeliveryStatusEnum,
  provider_reference: z.string().optional(),
  sent_at: z.string().datetime().optional(),
  delivered_at: z.string().datetime().optional(),
  failed_at: z.string().datetime().optional(),
  failure_reason: z.string().optional(),
  retry_count: z.number().int().default(0),
});
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

// ─── Alert Schemas ────────────────────────────────────────────────────────────

export const AlertSeverityEnum = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;

export const SafetyAlertSchema = z.object({
  alert_id: z.string().uuid(),
  event_id: z.string().uuid().optional(),
  city_id: z.string().uuid().optional(),
  country_code: z.string().length(2),
  severity: AlertSeverityEnum,
  title: z.string().max(200),
  body: z.string().max(4000),
  issued_by: z.string().uuid(), // admin user ID
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  is_active: z.boolean().default(true),
  source_url: z.string().url().optional(),
  affected_user_count: z.number().int().optional(),
});
export type SafetyAlert = z.infer<typeof SafetyAlertSchema>;

export const VisaAlertSchema = z.object({
  alert_id: z.string().uuid(),
  country_code: z.string().length(2),
  affected_nationalities: z.array(z.string().length(2)), // ISO 3166-1 alpha-2
  alert_type: z.enum(['policy_change', 'deadline', 'requirement_update', 'advisory']),
  title: z.string().max(200),
  body: z.string().max(4000),
  issued_by: z.string().uuid(),
  issued_at: z.string().datetime(),
  effective_date: z.string().datetime().optional(),
  source_url: z.string().url().optional(),
  is_active: z.boolean().default(true),
});
export type VisaAlert = z.infer<typeof VisaAlertSchema>;

// ─── API Request/Response Schemas ─────────────────────────────────────────────

export const GetNotificationsQuerySchema = z.object({
  category: NotificationCategoryEnum.optional(),
  is_read: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  event_id: z.string().uuid().optional(),
});
export type GetNotificationsQuery = z.infer<typeof GetNotificationsQuerySchema>;

export const MarkReadRequestSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});
export type MarkReadRequest = z.infer<typeof MarkReadRequestSchema>;

export const UpdatePreferencesRequestSchema = z.object({
  global_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  timezone: z.string().optional(),
  topic_subscriptions: z.array(z.object({
    topic: NotificationTopicEnum,
    enabled: z.boolean(),
    channels: ChannelPreferenceSchema.partial(),
  })).optional(),
});
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;

export const RegisterDeviceTokenRequestSchema = z.object({
  device_id: z.string().min(1).max(200),
  provider: PushProviderEnum,
  token: z.string().min(10).max(4096),
});
export type RegisterDeviceTokenRequest = z.infer<typeof RegisterDeviceTokenRequestSchema>;

export const SendNotificationRequestSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(10000),
  category: NotificationCategoryEnum,
  priority: NotificationPriorityEnum,
  title: z.string().max(200),
  body: z.string().max(2000),
  image_url: z.string().url().optional(),
  deep_link: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  event_id: z.string().uuid().optional(),
  channels: z.array(NotificationChannelEnum).optional(),
  expires_in_seconds: z.number().int().min(60).max(604800).optional(), // 1 min to 7 days
});
export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;

export const NotificationsPageSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread_count: z.number().int(),
  next_cursor: z.string().optional(),
  total: z.number().int(),
});
export type NotificationsPage = z.infer<typeof NotificationsPageSchema>;