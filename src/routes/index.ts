import { Router } from 'express';
import { recommendationRouter } from './recommendationRoutes';
import { tripAssistantRouter } from './tripAssistantRoutes';

export const apiRouter = Router();

// Existing routes preserved from main.
apiRouter.use('/recommendations', recommendationRouter);

// Added by ai-trip-assistant chunk.
apiRouter.use('/trip-assistant', tripAssistantRouter);