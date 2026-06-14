import { Router } from 'express';
import { eventRoutes } from './events';
import { communityRoutes } from './communities';
import { fanProfileRoutes } from './fanProfiles';
import { localHelperRoutes } from './localHelpers';
import { communityTripRoutes } from './communityTrips';
import { adminConsoleRoutes } from './admin/console';
import { adminAnalyticsRoutes } from './admin/analytics';

const router = Router();

// Public + authenticated feature routes (already merged)
router.use('/events', eventRoutes);
router.use('/communities', communityRoutes);
router.use('/fan-profiles', fanProfileRoutes);
router.use('/local-helpers', localHelperRoutes);
router.use('/community-trips', communityTripRoutes);

// Admin console + analytics (this chunk)
router.use('/admin/console', adminConsoleRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);

export { router };