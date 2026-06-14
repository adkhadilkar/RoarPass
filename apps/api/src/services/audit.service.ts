import { db } from "../db";

export interface AuditEvent {
  event: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  // Allow any additional string keys
  [key: string]: unknown;
}

/**
 * Writes an immutable audit log entry.
 * NEVER log secrets, tokens, or raw message content.
 */
export async function createAuditLog(entry: AuditEvent): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (event, user_id, resource_type, resource_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      entry.event,
      entry.user_id ?? null,
      entry.resource_type ?? null,
      entry.resource_id ?? null,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(entry).filter(
            ([k]) =>
              !["event", "user_id", "resource_type", "resource_id"].includes(k),
          ),
        ),
      ),
    ],
  );
}