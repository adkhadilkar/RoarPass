import { Router } from 'express';
import { fanProfileRouter } from './routes/fanProfile';
import { countryCommunityRouter } from './routes/countryCommunity';
import { eventRegistryRouter } from './routes/eventRegistry';

const apiRouter = Router();

// Previously merged chunks
apiRouter.use('/fan-profiles', fanProfileRouter);
apiRouter.use('/country-communities', countryCommunityRouter);

// event-registry chunk
apiRouter.use('/events', eventRegistryRouter);

export { apiRouter };