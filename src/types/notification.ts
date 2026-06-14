export enum NotificationType {
  TRIP_UPDATE = 'TRIP_UPDATE',
  TRIP_INVITE = 'TRIP_INVITE',
  HELPER_MESSAGE = 'HELPER_MESSAGE',
  // Added by community-moderation chunk:
  MODERATION_ACTION = 'MODERATION_ACTION',
  REPORT_RECEIVED = 'REPORT_RECEIVED',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}