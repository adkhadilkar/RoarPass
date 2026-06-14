import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  CheckInRequestSchema,
  CheckOutRequestSchema,
} from '@roarpass/shared/types/safety';
import { MeetupCheckInService } from '../../services/safety/MeetupCheckInService';

const meetupCheckInRouter = Router();
const svc = new MeetupCheckInService();

/**
 * GET /safety/meetups/:meetupId/checkin
 * Get check-in status for a meetup.
 */
meetupCheckInRouter.get(
  '/:meetupId/checkin',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const status = await svc.getStatus(req.user!.id, req.params.meetupId);
      if (!status) return res.status(404).json({ error: 'CHECKIN_NOT_FOUND' });
      res.json(status);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

/**
 * POST /safety/meetups/:meetupId/checkin
 * Check in to a meetup.
 */
meetupCheckInRouter.post(
  '/:meetupId/checkin',
  requireAuth,
  validate(CheckInRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const checkin = await svc.checkIn(req.user!.id, req.params.meetupId, req.body);
      res.status(201).json(checkin);
    } catch (err: any) {
      if (err.code === 'ALREADY_CHECKED_IN') {
        res.status(409).json({ error: 'ALREADY_CHECKED_IN' });
      } else if (err.code === 'MEETUP_NOT_FOUND') {
        res.status(404).json({ error: 'MEETUP_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * POST /safety/meetups/:meetupId/checkout
 * Check out of a meetup.
 */
meetupCheckInRouter.post(
  '/:meetupId/checkout',
  requireAuth,
  validate(CheckOutRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const checkin = await svc.checkOut(req.user!.id, req.params.meetupId, req.body);
      res.json(checkin);
    } catch (err: any) {
      if (err.code === 'NOT_CHECKED_IN') {
        res.status(409).json({ error: 'NOT_CHECKED_IN' });
      } else if (err.code === 'MEETUP_NOT_FOUND') {
        res.status(404).json({ error: 'MEETUP_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

export { meetupCheckInRouter };