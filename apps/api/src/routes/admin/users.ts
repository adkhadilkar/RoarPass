import { Router } from 'express';
import { z } from 'zod';
import {
  PaginationQuerySchema,
  UpdateUserStatusSchema,
  UpdateUserTrustTierSchema,
  UserFilterSchema,
} from '@roarpass/shared/types/admin';
import { requireAdminAuth, requireRole } from '../../middleware/adminAuth';
import { withAuditLog } from '../../middleware/adminAudit';
import { db } from '../../lib/db';
import { validateQuery, validateBody } from '../../lib/validate';

const router = Router();
router.use(requireAdminAuth, withAuditLog);

// GET /admin/users
router.get(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST'),
  validateQuery(PaginationQuerySchema.merge(UserFilterSchema)),
  async (req, res) => {
    try {
      const { page, limit, trust_tier, status, nationality, search, flagged } = req.query as any;
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (trust_tier) { conditions.push(`u.trust_tier = $${p++}`); params.push(trust_tier); }
      if (status) { conditions.push(`u.status = $${p++}`); params.push(status); }
      if (nationality) { conditions.push(`u.nationality = $${p++}`); params.push(nationality); }
      if (search) { conditions.push(`u.display_name ILIKE $${p++}`); params.push(`%${search}%`); }
      if (flagged === true || flagged === 'true') {
        conditions.push(`(SELECT COUNT(*) FROM user_reports ur WHERE ur.target_user_id = u.user_id AND ur.status='OPEN') > 0`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [{ rows }, { rows: countRows }] = await Promise.all([
        db.query(
          `SELECT u.user_id, u.display_name,
                  -- Mask email: show first char + domain with starred local part
                  CONCAT(LEFT(u.email,1), '***@', SPLIT_PART(u.email,'@',2)) AS email_masked,
                  u.nationality, u.trust_tier, u.role, u.status,
                  u.created_at, u.last_active_at,
                  (SELECT COUNT(*) FROM user_reports WHERE target_user_id=u.user_id) AS flags_received,
                  (SELECT COUNT(*) FROM user_reports WHERE reporter_id=u.user_id) AS reports_filed
           FROM users u
           ${where}
           ORDER BY u.created_at DESC
           LIMIT $${p++} OFFSET $${p++}`,
          [...params, limit, offset]
        ),
        db.query(`SELECT COUNT(*) FROM users u ${where}`, params),
      ]);

      res.json({
        data: rows,
        total: parseInt(countRows[0].count, 10),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countRows[0].count, 10) / limit),
      });
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

// GET /admin/users/:userId
router.get(
  '/:userId',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
  async (req, res) => {
    const { userId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

    try {
      const { rows } = await db.query(
        `SELECT u.user_id, u.display_name,
                CONCAT(LEFT(u.email,1), '***@', SPLIT_PART(u.email,'@',2)) AS email_masked,
                u.nationality, u.trust_tier, u.role, u.status, u.created_at, u.last_active_at,
                (SELECT COUNT(*) FROM user_reports WHERE target_user_id=u.user_id) AS flags_received,
                (SELECT COUNT(*) FROM user_reports WHERE reporter_id=u.user_id) AS reports_filed
         FROM users u WHERE u.user_id=$1`,
        [userId]
      );
      if (!rows.length) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

// PATCH /admin/users/:userId/status
router.patch(
  '/:userId/status',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
  validateBody(UpdateUserStatusSchema),
  async (req, res) => {
    const { userId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

    const { status, reason, duration_hours } = req.body;

    try {
      const suspendedUntil = duration_hours
        ? new Date(Date.now() + duration_hours * 3600 * 1000).toISOString()
        : null;

      const { rows } = await db.query(
        `UPDATE users SET status=$1, suspended_until=$2, updated_at=NOW()
         WHERE user_id=$3 RETURNING user_id, status, suspended_until`,
        [status, suspendedUntil, userId]
      );
      if (!rows.length) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      await req.auditLog?.({
        action: 'USER_STATUS_UPDATE',
        targetType: 'USER',
        targetId: userId,
        changes: { status, reason, duration_hours },
      });

      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

// PATCH /admin/users/:userId/trust-tier
router.patch(
  '/:userId/trust-tier',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateBody(UpdateUserTrustTierSchema),
  async (req, res) => {
    const { userId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

    const { trust_tier, reason } = req.body;

    try {
      const { rows } = await db.query(
        `UPDATE users SET trust_tier=$1, updated_at=NOW() WHERE user_id=$2 RETURNING user_id, trust_tier`,
        [trust_tier, userId]
      );
      if (!rows.length) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      await req.auditLog?.({
        action: 'USER_TRUST_TIER_UPDATE',
        targetType: 'USER',
        targetId: userId,
        changes: { trust_tier, reason },
      });

      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

export default router;