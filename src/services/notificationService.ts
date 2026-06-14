import { db } from '../db';
import { Notification, NotificationType } from '../types/notification';

export class NotificationService {
  async send(userId: string, type: NotificationType, payload: Record<string, unknown>): Promise<Notification> {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        payload,
        read: false,
        createdAt: new Date(),
      },
    });
    await this.dispatch(notification);
    return notification;
  }

  // Merged: trip notifications (from main) + moderation notifications (from community-moderation)
  async notifyTripUpdate(userId: string, tripId: string): Promise<Notification> {
    return this.send(userId, NotificationType.TRIP_UPDATE, { tripId });
  }

  async notifyModerationAction(
    userId: string,
    reportId: string,
    action: 'warned' | 'removed' | 'dismissed',
  ): Promise<Notification> {
    return this.send(userId, NotificationType.MODERATION_ACTION, { reportId, action });
  }

  private async dispatch(notification: Notification): Promise<void> {
    // delivery channel routing unchanged
    await db.notificationQueue.enqueue(notification);
  }
}