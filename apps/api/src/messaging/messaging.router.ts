import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { messagingService } from './messaging.service';
import { requireAuth, requireChannelMember, requireChannelModerator } from '../middleware/auth';
import {
  SendMessageRequestSchema,
  UpdateMessageRequestSchema,
  CreateChannelRequestSchema,
  CreateThreadRequestSchema,
  ListMessagesQuerySchema,
} from '@roarpass/shared/types/messaging';
import { rateLimiter } from '../middleware/rate-limiter';
import { validateBody, validateQuery } from '../middleware/validate';

const router = Router();

// All messaging routes require authentication
router.use(requireAuth);

// ─── Channels ──────────────────────────────────────────────────────────────────

/**
 * POST /v1/messaging/channels
 * Create a new channel (DM, group, community, match-day, announcement)
 */
router.post(
  '/channels',
  rateLimiter({ windowMs: 60_000, max: 20 }),
  validateBody(CreateChannelRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await messagingService.createChannel(
        req.user!.userId,
        req.body
      );
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/messaging/channels
 * List channels the authenticated user is a member of
 */
router.get(
  '/channels',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channels = await messagingService.listUserChannels(req.user!.userId);
      res.json({ channels });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/messaging/channels/:channelId
 */
router.get(
  '/channels/:channelId',
  requireChannelMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await messagingService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'CHANNEL_NOT_FOUND' });
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /v1/messaging/channels/:channelId
 * Update channel metadata (moderator only)
 */
router.patch(
  '/channels/:channelId',
  requireChannelModerator,
  validateBody(
    z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      is_read_only: z.boolean().optional(),
      community_default_language: z.string().length(2).nullable().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await messagingService.updateChannel(
        req.params.channelId,
        req.body
      );
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Participants ─────────────────────────────────────────────────────────────

/**
 * POST /v1/messaging/channels/:channelId/participants
 */
router.post(
  '/channels/:channelId/participants',
  requireChannelModerator,
  validateBody(
    z.object({
      user_ids: z.array(z.string().uuid()).min(1).max(50),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messagingService.addParticipants(
        req.params.channelId,
        req.body.user_ids
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/messaging/channels/:channelId/participants/:userId
 * Remove self (leave) or moderator removes another
 */
router.delete(
  '/channels/:channelId/participants/:userId',
  requireChannelMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId, userId } = req.params;
      const callerRole = req.channelParticipant!.role;
      // Only self-leave or moderator/owner can remove others
      if (
        userId !== req.user!.userId &&
        callerRole !== 'MODERATOR' &&
        callerRole !== 'OWNER'
      ) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      await messagingService.removeParticipant(channelId, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * GET /v1/messaging/channels/:channelId/messages
 */
router.get(
  '/channels/:channelId/messages',
  requireChannelMember,
  validateQuery(ListMessagesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messagingService.listMessages(
        req.params.channelId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/messaging/channels/:channelId/messages
 */
router.post(
  '/channels/:channelId/messages',
  requireChannelMember,
  rateLimiter({ windowMs: 60_000, max: 120 }),
  validateBody(SendMessageRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await messagingService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'CHANNEL_NOT_FOUND' });

      // Enforce read-only for non-moderators in announcement channels
      if (
        channel.is_read_only &&
        req.channelParticipant!.role === 'MEMBER' &&
        req.channelParticipant!.role === 'READONLY'
      ) {
        return res.status(403).json({ error: 'CHANNEL_IS_READ_ONLY' });
      }

      const message = await messagingService.sendMessage(
        req.user!.userId,
        req.params.channelId,
        req.body
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/messaging/channels/:channelId/messages/:messageId
 */
router.get(
  '/channels/:channelId/messages/:messageId',
  requireChannelMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagingService.getMessage(
        req.params.channelId,
        req.params.messageId
      );
      if (!message) return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
      res.json(message);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /v1/messaging/channels/:channelId/messages/:messageId
 * Edit own message (sender only)
 */
router.patch(
  '/channels/:channelId/messages/:messageId',
  requireChannelMember,
  validateBody(UpdateMessageRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await messagingService.getMessage(
        req.params.channelId,
        req.params.messageId
      );
      if (!existing) return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
      if (existing.sender_id !== req.user!.userId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      if (existing.message_type === 'SYSTEM' || existing.message_type === 'ANNOUNCEMENT') {
        return res.status(403).json({ error: 'CANNOT_EDIT_SYSTEM_MESSAGE' });
      }
      const updated = await messagingService.editMessage(
        req.params.messageId,
        req.body.content
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/messaging/channels/:channelId/messages/:messageId
 * Soft-delete: sender or moderator
 */
router.delete(
  '/channels/:channelId/messages/:messageId',
  requireChannelMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await messagingService.getMessage(
        req.params.channelId,
        req.params.messageId
      );
      if (!existing) return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });

      const role = req.channelParticipant!.role;
      const isSender = existing.sender_id === req.user!.userId;
      const isMod = role === 'MODERATOR' || role === 'OWNER';

      if (!isSender && !isMod) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      await messagingService.deleteMessage(req.params.messageId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ─── Read Receipts ────────────────────────────────────────────────────────────

/**
 * POST /v1/messaging/channels/:channelId/messages/:messageId/read
 */
router.post(
  '/channels/:channelId/messages/:messageId/read',
  requireChannelMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messagingService.markRead(
        req.params.channelId,
        req.params.messageId,
        req.user!.userId
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ─── Threads ──────────────────────────────────────────────────────────────────

/**
 * POST /v1/messaging/channels/:channelId/threads
 */
router.post(
  '/channels/:channelId/threads',
  requireChannelMember,
  rateLimiter({ windowMs: 60_000, max: 60 }),
  validateBody(CreateThreadRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { thread, message } = await messagingService.createThread(
        req.user!.userId,
        req.params.channelId,
        req.body
      );
      res.status(201).json({ thread, message });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/messaging/channels/:channelId/threads/:threadId/messages
 */
router.get(
  '/channels/:channelId/threads/:threadId/messages',
  requireChannelMember,
  validateQuery(ListMessagesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messagingService.listThreadMessages(
        req.params.threadId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/messaging/channels/:channelId/threads/:threadId/messages
 */
router.post(
  '/channels/:channelId/threads/:threadId/messages',
  requireChannelMember,
  rateLimiter({ windowMs: 60_000, max: 120 }),
  validateBody(SendMessageRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagingService.replyToThread(
        req.user!.userId,
        req.params.channelId,
        req.params.threadId,
        req.body
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Announcements (read-only channels, moderator-post only) ─────────────────

/**
 * POST /v1/messaging/channels/:channelId/announcements
 */
router.post(
  '/channels/:channelId/announcements',
  requireChannelModerator,
  rateLimiter({ windowMs: 60_000, max: 10 }),
  validateBody(
    z.object({
      content: z.string().min(1).max(10_000),
      is_official: z.boolean().default(true),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagingService.postAnnouncement(
        req.user!.userId,
        req.params.channelId,
        req.body
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

export { router as messagingRouter };