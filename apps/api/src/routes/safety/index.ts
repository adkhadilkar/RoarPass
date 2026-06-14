import { Router } from 'express';
import { safetyProfileRouter } from './safetyProfile';
import { trustedContactsRouter } from './trustedContacts';
import { meetupCheckInRouter } from './meetupCheckIn';
import { sosRouter } from './sos';
import { locationShareRouter } from './locationShare';

const safetyRouter = Router();

safetyRouter.use('/profile', safetyProfileRouter);
safetyRouter.use('/trusted-contacts', trustedContactsRouter);
safetyRouter.use('/meetups', meetupCheckInRouter);
safetyRouter.use('/sos', sosRouter);
safetyRouter.use('/location', locationShareRouter);

export { safetyRouter };