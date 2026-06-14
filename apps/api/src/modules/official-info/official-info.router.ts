/**
 * Express router: Official Information & Visa Intelligence
 * Chunk: official-info-layer | PRD 7.8.1, 7.8.2, 7.8.4
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  listGuidesHandler,
  getGuideHandler,
  createGuideHandler,
  updateGuideHandler,
  deleteGuideHandler,
  listMatchScheduleHandler,
  getMatchHandler,
  getVisaIntelligenceHandler,
  listVisaIntelligenceForNationalityHandler,
  upsertVisaIntelligenceHandler,
  deleteVisaIntelligenceHandler,
  listSourcesHandler,
  createSourceHandler,
  updateSourceHandler,
  deleteSourceHandler,
} from './official-info.handlers';
import {
  listGuidesQuerySchema,
  createGuideBodySchema,
  updateGuideBodySchema,
  listMatchScheduleQuerySchema,
  getVisaIntelligenceQuerySchema,
  listVisaNationalityQuerySchema,
  upsertVisaIntelligenceBodySchema,
  upsertSourceBodySchema,
} from './official-info.validation';

const router = Router();

// ─── Public / authenticated fan routes ────────────────────────────────────────

/**
 * GET /v1/official-info/guides
 * List event/city guides, optionally filtered by event, city, type, locale.
 */
router.get(
  '/guides',
  requireAuth,
  validateQuery(listGuidesQuerySchema),
  listGuidesHandler,
);

/**
 * GET /v1/official-info/guides/:guide_id
 * Single guide with all localisations (caller picks locale client-side).
 */
router.get(
  '/guides/:guide_id',
  requireAuth,
  getGuideHandler,
);

/**
 * GET /v1/official-info/schedule
 * Match schedule feed with timezone conversion.
 */
router.get(
  '/schedule',
  requireAuth,
  validateQuery(listMatchScheduleQuerySchema),
  listMatchScheduleHandler,
);

/**
 * GET /v1/official-info/schedule/:match_id
 * Single match entry.
 */
router.get(
  '/schedule/:match_id',
  requireAuth,
  getMatchHandler,
);

/**
 * GET /v1/official-info/visa
 * Visa intelligence for a specific nationality × destination pair.
 * Query: event_id, nationality_code, destination_country_code
 */
router.get(
  '/visa',
  requireAuth,
  validateQuery(getVisaIntelligenceQuerySchema),
  getVisaIntelligenceHandler,
);

/**
 * GET /v1/official-info/visa/nationality/:nationality_code
 * All destination countries' visa intel for a given nationality in an event.
 * Query: event_id
 */
router.get(
  '/visa/nationality/:nationality_code',
  requireAuth,
  validateQuery(listVisaNationalityQuerySchema),
  listVisaIntelligenceForNationalityHandler,
);

// ─── Admin routes ──────────────────────────────────────────────────────────────

router.post(
  '/admin/guides',
  requireAuth,
  requireRole('ADMIN', 'EVENT_MANAGER'),
  validateBody(createGuideBodySchema),
  createGuideHandler,
);

router.put(
  '/admin/guides/:guide_id',
  requireAuth,
  requireRole('ADMIN', 'EVENT_MANAGER'),
  validateBody(updateGuideBodySchema),
  updateGuideHandler,
);

router.delete(
  '/admin/guides/:guide_id',
  requireAuth,
  requireRole('ADMIN', 'EVENT_MANAGER'),
  deleteGuideHandler,
);

router.post(
  '/admin/visa',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(upsertVisaIntelligenceBodySchema),
  upsertVisaIntelligenceHandler,
);

router.delete(
  '/admin/visa/:visa_id',
  requireAuth,
  requireRole('ADMIN'),
  deleteVisaIntelligenceHandler,
);

router.get(
  '/admin/sources',
  requireAuth,
  requireRole('ADMIN', 'EVENT_MANAGER'),
  listSourcesHandler,
);

router.post(
  '/admin/sources',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(upsertSourceBodySchema),
  createSourceHandler,
);

router.put(
  '/admin/sources/:source_id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(upsertSourceBodySchema),
  updateSourceHandler,
);

router.delete(
  '/admin/sources/:source_id',
  requireAuth,
  requireRole('ADMIN'),
  deleteSourceHandler,
);

export default router;