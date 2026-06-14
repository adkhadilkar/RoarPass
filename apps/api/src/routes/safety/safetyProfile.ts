import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { SafetyProfileService } from '../../services/safety/SafetyProfileService';
import { UpsertSafetyProfileSchema } from '@roarpass/shared/types/safety';

const safetyProfileRouter = Router();
const svc = new SafetyProfileService();

/**
 * GET /safety/profile
 * Returns the current user's safety profile.
 */
safetyProfileRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await svc.getOrCreate(req.user!.id);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /safety/profile
 * Update safety mode, location share settings, check-in intervals.
 */
safetyProfileRouter.patch(
  '/',
  requireAuth,
  validate(UpsertSafetyProfileSchema),
  async (req: Request, res: Response) => {
    try {
      const updated = await svc.update(req.user!.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

export { safetyProfileRouter };