import { Router } from 'express';
import { authRouter } from './auth';
import { eventsRouter } from './events';
import { communitiesRouter } from './communities';
import { fanProfilesRouter } from './fanProfiles';
import { localHelpersRouter } from './localHelpers';
import { communityTripsRouter } from './communityTrips';
import { businessPartnerRouter } from './businessPartner';

const router = Router();

router.use('/auth', authRouter);
router.use('/events', eventsRouter);
router.use('/communities', communitiesRouter);
router.use('/fan-profiles', fanProfilesRouter);
router.use('/local-helpers', localHelpersRouter);
router.use('/community-trips', communityTripsRouter);
router.use('/business-partners', businessPartnerRouter);

export default router;