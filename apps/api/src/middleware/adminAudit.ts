import { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';

interface AuditContext {
  action: string;
  targetType: string;
  targetId: string;
  changes?: Record<string, unknown>;
}

/** Attach to a request so the route handler can call `req.audit(...)` */
export function withAuditLog(req: Request, _res: Response, next: NextFunction): void {
  req.auditLog = async (ctx: AuditContext) => {
    if (!req.adminUser) return;

    const rawIp = req.ip ?? req.socket.remoteAddress ?? '';
    // Mask last octet of IPv4 / last group of IPv6
    const maskedIp = rawIp.replace(/(\d+)$/, '***').replace(/:[^:]+$/, ':***');

    await db.query(
      `INSERT INTO admin_audit_log
         (admin_id, admin_role, action, target_type, target_id, changes, ip_address_masked, user_agent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        req.adminUser.sub,
        req.adminUser.role,
        ctx.action,
        ctx.targetType,
        ctx.targetId,
        JSON.stringify(ctx.changes ?? {}),
        maskedIp,
        req.headers['user-agent']?.slice(0, 256) ?? '',
      ]
    );
  };
  next();
}

declare global {
  namespace Express {
    interface Request {
      auditLog?: (ctx: AuditContext) => Promise<void>;
    }
  }
}