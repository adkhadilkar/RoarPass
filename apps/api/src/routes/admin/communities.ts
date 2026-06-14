import { Router } from 'express';
import {
  PaginationQuerySchema,
  UpdateCommunityStatusSchema,
} from '@roarpass/shared/types/admin';
import { requireAdminAuth, requireRole } from '../../middleware/adminAuth';
import { withAuditLog } from '../../middleware/adminAudit';
import { db } from '../../lib/db';
import { validateQuery, validateBody } from '../../lib/validate';

const router = Router();
router.use(requireAdminAuth, withAuditLog);

// GET /admin/communities
router.get(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST'),
  validateQuery(PaginationQuerySchema),
  async (req, res) => {
    try {
      const { page, limit } = req.query as any;
      const offset = (page - 1) * limit;

      const [{ rows }, { rows: countRows }] = await Promise.all([
        db.query(
          `SELECT c.community_id, c.name, c.type, c.country_code, c.status, c.created_at,
                  COUNT(DISTINCT cm.user_id) AS member_count,
                  COUNT(DISTINCT mod.user_id) AS moderator_count,
                  COUNT(DISTINCT r.report_id) FILTER (WHERE r.status='OPEN') AS open_reports
           FROM communities c
           LEFT JOIN community_members cm ON cm.community_id = c.community_id
           LEFT JOIN community_moderators mod ON mod.community_id = c.community_id
           LEFT JOIN content_reports r ON r.community_id = c.community_id
           GROUP BY c.community_id
           ORDER BY open_reports DESC, c.created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        db.query(`SELECT COUNT(*) FROM communities`),
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

// PATCH /admin/communities/:communityId/status
router.patch(
  '/:communityId/status',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateBody(UpdateCommunityStatusSchema),
  async (req, res) => {
    const { communityId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(communityId)) {
      return res.status(400).json({ error: 'INVALID_COMMUNITY_ID' });
    }

    const { status, reason } = req.body;

    try {
      const { rows } = await db.query(
        `UPDATE communities SET status=$1, updated_at=NOW() WHERE community_id=$2 RETURNING *`,
        [status, communityId]
      );
      if (!rows.length) return res.status(404).json({ error: 'COMMUNITY_NOT_FOUND' });

      await req.auditLog?.({
        action: 'COMMUNITY_STATUS_UPDATE',
        targetType: 'COMMUNITY',
        targetId: communityId,
        changes: { status, reason },
      });

      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }
);

export default router;