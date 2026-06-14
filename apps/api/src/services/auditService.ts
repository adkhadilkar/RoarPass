import { db } from '../lib/db';
import { AuditLogEntry } from '@roarpass/shared/types/admin';

interface CreateAuditLogParams {
  adminUserId: string;
  adminDisplayName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<string> {
  const result = await db.query(
    `INSERT INTO admin_audit_logs (
      admin_user_id, admin_display_name, action, resource_type,
      resource_id, changes, ip_address, user_agent, metadata, performed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING audit_id`,
    [
      params.adminUserId,
      params.adminDisplayName,
      params.action,
      params.resourceType,
      params.resourceId,
      JSON.stringify(params.changes),
      params.ipAddress,
      params.userAgent,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
  return result.rows[0].audit_id as string;
}

export async function getAuditLogs(filters: {
  adminUserId?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}): Promise<{ data: AuditLogEntry[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.adminUserId) {
    conditions.push(`admin_user_id = $${idx++}`);
    values.push(filters.adminUserId);
  }
  if (filters.resourceType) {
    conditions.push(`resource_type = $${idx++}`);
    values.push(filters.resourceType);
  }
  if (filters.resourceId) {
    conditions.push(`resource_id = $${idx++}`);
    values.push(filters.resourceId);
  }
  if (filters.from) {
    conditions.push(`performed_at >= $${idx++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`performed_at <= $${idx++}`);
    values.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const [dataResult, countResult] = await Promise.all([
    db.query(
      `SELECT audit_id, admin_user_id, admin_display_name, action, resource_type,
              resource_id, changes, ip_address, user_agent, performed_at
       FROM admin_audit_logs
       ${where}
       ORDER BY performed_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, filters.limit, offset],
    ),
    db.query(`SELECT COUNT(*) FROM admin_audit_logs ${where}`, values),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);
  const data: AuditLogEntry[] = dataResult.rows.map((row) => ({
    auditId: row.audit_id,
    adminUserId: row.admin_user_id,
    adminDisplayName: row.admin_display_name,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    changes: row.changes,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    performedAt: row.performed_at,
  }));

  return { data, total };
}