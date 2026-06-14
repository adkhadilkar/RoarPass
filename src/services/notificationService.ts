import { db } from '../db';
import { Notification, NotificationType } from '../models/notification';
import { getUserLocale } from './userService';
import { translate } from '../i18n';

export class NotificationService {
  async create(params: {
    userId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
  }): Promise<Notification> {
    const locale = await getUserLocale(params.userId);
    const message = translate(params.type, locale, params.payload);

    return db.notifications.insert({
      userId: params.userId,
      type: params.type,
      payload: params.payload,
      message,
      read: false,
      createdAt: new Date(),
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await db.notifications.update(
      { id: notificationId, userId },
      { read: true, readAt: new Date() }
    );
  }

  async listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number; cursor?: string } = {}
  ): Promise<{ items: Notification[]; nextCursor?: string }> {
    return db.notifications.paginate({
      where: { userId, ...(opts.unreadOnly ? { read: false } : {}) },
      limit: opts.limit ?? 20,
      cursor: opts.cursor,
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const notificationService = new NotificationService();