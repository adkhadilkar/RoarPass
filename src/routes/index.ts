import { Router } from 'express';
import { tripRouter } from './trips';
import { helperRouter } from './helpers';
import { profileRouter } from './profiles';
import { moderationRouter } from './moderation';

export const apiRouter = Router();

// Existing routes (main)
apiRouter.use('/trips', tripRouter);
apiRouter.use('/helpers', helperRouter);
apiRouter.use('/profiles', profileRouter);

// community-moderation chunk
apiRouter.use('/moderation', moderationRouter);