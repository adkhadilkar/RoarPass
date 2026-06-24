import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth';
import { validateBody } from '../middleware/validate';
import * as tripController from './controllers/community-trip.controller';
import * as itineraryController from './controllers/trip-itinerary.controller';
import {
  createTripSchema,
  updateTripSchema,
} from './schemas/community-trip.schema';
import {
  upsertItinerarySchema,
  addStopSchema,
  updateStopSchema,
} from './schemas/trip-itinerary.schema';

const router = Router();

// --- Community Trip core (previously merged) ---
router.get('/trips', requireAuth, tripController.listTrips);
router.post('/trips', requireAuth, validateBody(createTripSchema), tripController.createTrip);
router.get('/trips/:tripId', requireAuth, tripController.getTrip);
router.patch(
  '/trips/:tripId',
  requireAuth,
  validateBody(updateTripSchema),
  tripController.updateTrip,
);
router.delete('/trips/:tripId', requireAuth, tripController.deleteTrip);

// --- Trip Itinerary (trip-itinerary chunk) ---
router.get('/trips/:tripId/itinerary', requireAuth, itineraryController.getItinerary);
router.put(
  '/trips/:tripId/itinerary',
  requireAuth,
  validateBody(upsertItinerarySchema),
  itineraryController.upsertItinerary,
);
router.post(
  '/trips/:tripId/itinerary/days/:dayId/stops',
  requireAuth,
  validateBody(addStopSchema),
  itineraryController.addStop,
);
router.patch(
  '/trips/:tripId/itinerary/stops/:stopId',
  requireAuth,
  validateBody(updateStopSchema),
  itineraryController.updateStop,
);
router.delete(
  '/trips/:tripId/itinerary/stops/:stopId',
  requireAuth,
  itineraryController.deleteStop,
);

export default router;