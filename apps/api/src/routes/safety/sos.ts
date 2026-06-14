import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ActivateSOSSchema } from '@roarpass/shared/types/safety';
import { SOSService } from '../../services/safety/SOSService';

const sosRouter = Router();
const svc = new SOSService();

/**
 * POST /safety/sos/activate
 * Activate emergency SOS. Notifies trusted contacts, platform safety team.
 */
sosRouter.post(
  '/activate',
  requireAuth,
  validate(ActivateSOSSchema),
  async (req: Request, res: Response) => {
    try {
      const sosEvent = await svc.activate(req.user!.id, req.body);
      res.status(201).json(sosEvent);
    } catch (err: any) {
      if (err.code === 'SOS_ALREADY_ACTIVE') {
        res.status(409).json({ error: 'SOS_ALREADY_ACTIVE' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * POST /safety/sos/:sosId/cancel
 * Cancel an active SOS (e.g., false alarm during countdown).
 */
sosRouter.post(
  '/:sosId/cancel',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const sosEvent = await svc.cancel(req.user!.id, req.params.sosId);
      res.json(sosEvent);
    } catch (err: any) {
      if (err.code === 'SOS_NOT_FOUND') {
        res.status(404).json({ error: 'SOS_NOT_FOUND' });
      } else if (err.code === 'SOS_NOT_ACTIVE') {
        res.status(409).json({ error: 'SOS_NOT_ACTIVE' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * POST /safety/sos/:sosId/resolve
 * Mark SOS as resolved.
 */
sosRouter.post(
  '/:sosId/resolve',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      const sosEvent = await svc.resolve(req.user!.id, req.params.sosId, notes);
      res.json(sosEvent);
    } catch (err: any) {
      if (err.code === 'SOS_NOT_FOUND') {
        res.status(404).json({ error: 'SOS_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * GET /safety/sos/active
 * Get the current active SOS event for the user (if any).
 */
sosRouter.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const sosEvent = await svc.getActive(req.user!.id);
    if (!sosEvent) return res.status(404).json({ error: 'NO_ACTIVE_SOS' });
    res.json(sosEvent);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export { sosRouter };