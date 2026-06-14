import { Router } from 'express';
import { eventsRouter } from './events';
import { communitiesRouter } from './communities';
import { fanProfilesRouter } from './fanProfiles';
import { tripsRouter } from './trips';
import { helperNetworkRouter } from './helperNetwork';

export const apiRouter = Router();

// Already-merged chunks
apiRouter.use('/events', eventsRouter);
apiRouter.use('/communities', communitiesRouter);
apiRouter.use('/fan-profiles', fanProfilesRouter);
apiRouter.use('/trips', tripsRouter);

// helper-network chunk
apiRouter.use('/helpers', helperNetworkRouter);