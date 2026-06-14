import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  StartLocationShareSchema,
  UpdateLocationSchema,
} from '@roarpass/shared/types/safety';
import { LocationShareService } from '../../services/safety/LocationShareService';

const locationShareRouter = Router();
const svc = new LocationShareService();

/**
 * POST /safety/location/sessions
 * Start a location sharing session.
 */
locationShareRouter.post(
  '/sessions',
  requireAuth,
  validate(StartLocationShareSchema),
  async (req: Request, res: Response) => {
    try {
      const session = await svc.startSession(req.user!.id, req.body);
      res.status(201).json(session);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

/**
 * DELETE /safety/location/sessions/:sessionId
 * Stop a location sharing session.
 */
locationShareRouter.delete(
  '/sessions/:sessionId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await svc.stopSession(req.user!.id, req.params.sessionId);
      res.status(204).send();
    } catch (err: any) {
      if (err.code === 'SESSION_NOT_FOUND') {
        res.status(404).json({ error: 'SESSION_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * POST /safety/location/update
 * Push a location update for an active session.
 */
locationShareRouter.post(
  '/update',
  requireAuth,
  validate(UpdateLocationSchema),
  async (req: Request, res: Response) => {
    try {
      await svc.pushUpdate(req.user!.id, req.body);
      res.status(204).send();
    } catch (err: any) {
      if (err.code === 'SESSION_NOT_FOUND') {
        res.status(404).json({ error: 'SESSION_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * GET /safety/location/watching
 * Get locations being shared with the current user.
 */
locationShareRouter.get(
  '/watching',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const shares = await svc.getSharedWithMe(req.user!.id);
      res.json({ shares });
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

export { locationShareRouter };