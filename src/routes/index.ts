import { Router } from 'express';
import { eventRoutes } from './events';
import { communityRoutes } from './communities';
import { fanProfileRoutes } from './fanProfiles';
import { helperRoutes } from './helpers';
import { tripRoutes } from './trips';
import { notificationRoutes } from './notifications';

const router = Router();

// Existing chunks (preserved from main)
router.use('/events', eventRoutes);
router.use('/communities', communityRoutes);
router.use('/fan-profiles', fanProfileRoutes);
router.use('/helpers', helperRoutes);
router.use('/trips', tripRoutes);

// Merged chunk: notifications
router.use('/notifications', notificationRoutes);

export { router };