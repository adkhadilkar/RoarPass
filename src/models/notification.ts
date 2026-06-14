export type NotificationType =
  | 'TRIP_INVITE'
  | 'TRIP_UPDATE'
  | 'HELPER_REQUEST'
  | 'HELPER_ACCEPTED'
  | 'EVENT_REMINDER'
  | 'COMMUNITY_POST';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  message: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}