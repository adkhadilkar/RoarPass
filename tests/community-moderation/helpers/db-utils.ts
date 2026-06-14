import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DB_URL;
    if (!connectionString) throw new Error('DB_URL env var is not set');
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Fetch audit log entries from DB directly — bypasses API layer for integration assertions.
 */
export async function getAuditLogEntries(params: {
  communityId?: string;
  actorId?: string;
  action?: string;
  targetId?: string;
  since?: Date;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const p = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.communityId) {
    conditions.push(`community_id = $${idx++}`);
    values.push(params.communityId);
  }
  if (params.actorId) {
    conditions.push(`actor_id = $${idx++}`);
    values.push(params.actorId);
  }
  if (params.action) {
    conditions.push(`action = $${idx++}`);
    values.push(params.action);
  }
  if (params.targetId) {
    conditions.push(`target_id = $${idx++}`);
    values.push(params.targetId);
  }
  if (params.since) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(params.since);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 100;
  const query = `
    SELECT id, community_id, actor_id, action, target_type, target_id,
           metadata, ip_address, created_at
    FROM moderation_audit_log
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  const result = await p.query(query, values);
  return result.rows as AuditLogEntry[];
}

export async function getModerationQueueItemFromDB(itemId: string): Promise<ModerationQueueItem | null> {
  const p = getPool();
  const result = await p.query(
    `SELECT * FROM moderation_queue WHERE id = $1`,
    [itemId],
  );
  return result.rows[0] ?? null;
}

export async function getPostStatus(postId: string): Promise<string | null> {
  const p = getPool();
  const result = await p.query(`SELECT status FROM posts WHERE id = $1`, [postId]);
  return result.rows[0]?.status ?? null;
}

export async function getUserBanStatus(communityId: string, userId: string): Promise<boolean> {
  const p = getPool();
  const result = await p.query(
    `SELECT 1 FROM community_bans WHERE community_id = $1 AND user_id = $2 AND active = true`,
    [communityId, userId],
  );
  return result.rowCount > 0;
}

export interface AuditLogEntry {
  id: string;
  community_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: Date;
}

export interface ModerationQueueItem {
  id: string;
  community_id: string;
  post_id: string;
  reporter_id: string | null;
  reason: string;
  status: 'pending' | 'resolved' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  sla_deadline: Date;
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}