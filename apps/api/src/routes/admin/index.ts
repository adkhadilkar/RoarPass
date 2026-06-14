import { Router } from 'express';
import { adminUsersRouter } from './users';
import { adminEventsRouter } from './events';
import { adminCommunitiesRouter } from './communities';
import { adminHelpersRouter } from './helpers';
import { adminIncidentsRouter } from './incidents';
import { adminPartnersRouter } from './partners';
import { adminAnalyticsRouter } from './analytics';
import { requireAdmin } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimit';
import { auditLog } from '../../middleware/auditLog';

const router = Router();

// All admin routes require admin role + rate limiting + audit logging
router.use(requireAdmin);
router.use(rateLimiter({ windowMs: 60_000, max: 300, keyBy: 'user' }));
router.use(auditLog);

router.use('/users', adminUsersRouter);
router.use('/events', adminEventsRouter);
router.use('/communities', adminCommunitiesRouter);
router.use('/helpers', adminHelpersRouter);
router.use('/incidents', adminIncidentsRouter);
router.use('/partners', adminPartnersRouter);
router.use('/analytics', adminAnalyticsRouter);

export { router as adminRouter };