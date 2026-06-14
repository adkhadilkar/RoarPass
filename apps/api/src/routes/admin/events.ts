import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  requireAdminAuth,
  requirePermission,
  adminRateLimit,
} from '../../middleware/adminAuth';
import { createAuditLog } from '../../services/auditService';
import { db } from '../../lib/db';
import {
  UpdateEventStatusSchema,
  PaginationSchema,
  AdminEventRecord,
} from '@roarpass/shared/types/admin';

const router = Router();

// Apply rate limit + auth to all admin event routes
router.use(adminRateLimit, requireAdminAuth);

// ─── List Events ──────────────────────────────────────────────────────────────

router.get(
  '/',
  requirePermission('events:read'),
  async (req: Request, res: Response): Promise<void> => {
    const queryParse = PaginationSchema.safeParse(req.query);
    if (!queryParse.success) {
      res.status(400).json({ error: 'INVALID_PARAMS', details: queryParse.error.flatten() });
      return;
    }
    const { page, limit } = queryParse.data;
    const offset = (page - 1) * limit;

    const statusFilter = req.query.status as string | undefined;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (statusFilter) {
      const validStatuses = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
      if (!validStatuses.includes(statusFilter)) {
        res.status(400).json({ error: 'INVALID_STATUS' });
        return;
      }
      conditions.push(`e.status = $${idx++}`);
      values.push(statusFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT e.event_id, e.name, e.sport, e.host_cities, e.start_date, e.end_date,
                e.status, e.created_at, e.updated_at,
                COUNT(DISTINCT fe.user_id) AS registered_fans,
                COUNT(DISTINCT h.helper_id) FILTER (WHERE h.is_active) AS active_helpers,
                COUNT(DISTINCT bp.partner_id) FILTER (WHERE bp.is_active) AS partner_count,
                BOOL_AND(ehlm.phrase_cards_ready) AS phrase_cards_ready
         FROM events e
         LEFT JOIN fan_event_activations fe ON fe.event_id = e.event_id
         LEFT JOIN helpers h ON h.event_id = e.event_id
         LEFT JOIN business_partners bp ON bp.event_id = e.event_id
         LEFT JOIN event_host_language_mappings ehlm ON ehlm.event_id = e.event_id
         ${where}
         GROUP BY e.event_id
         ORDER BY e.start_date DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset],
      ),
      db.query(`SELECT COUNT(*) FROM events e ${where}`, values),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const events: AdminEventRecord[] = dataResult.rows.map((r) => ({
      eventId: r.event_id,
      name: r.name,
      sport: r.sport,
      hostCities: r.host_cities,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      registeredFans: parseInt(r.registered_fans, 10),
      activeHelpers: parseInt(r.active_helpers, 10),
      partnerCount: parseInt(r.partner_count, 10),
      phraseCardsReady: r.phrase_cards_ready ?? false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);

// ─── Update Event Status ──────────────────────────────────────────────────────

router.patch(
  '/:eventId/status',
  requirePermission('events:write'),
  async (req: Request, res: Response): Promise<void> => {
    const eventId = req.params.eventId;

    // Validate UUID format
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
      res.status(400).json({ error: 'INVALID_EVENT_ID' });
      return;
    }

    const bodyParse = UpdateEventStatusSchema.safeParse(req.body);
    if (!bodyParse.success) {
      res.status(400).json({ error: 'INVALID_BODY', details: bodyParse.error.flatten() });
      return;
    }
    const { status, reason } = bodyParse.data;

    // Fetch current status for audit diff
    const current = await db.query(
      'SELECT event_id, status FROM events WHERE event_id = $1',
      [eventId],
    );
    if (current.rows.length === 0) {
      res.status(404).json({ error: 'EVENT_NOT_FOUND' });
      return;
    }

    const prevStatus = current.rows[0].status;

    await db.query(
      'UPDATE events SET status = $1, updated_at = NOW() WHERE event_id = $2',
      [status, eventId],
    );

    await createAuditLog({
      adminUserId: req.adminUser!.adminUserId,
      adminDisplayName: req.adminUser!.displayName,
      action: 'EVENT_STATUS_UPDATED',
      resourceType: 'event',
      resourceId: eventId,
      changes: { status: { before: prevStatus, after: status } },
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
      metadata: { reason },
    });

    res.json({ eventId, status, updatedAt: new Date().toISOString() });
  },
);

export default router;