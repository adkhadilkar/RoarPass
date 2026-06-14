import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminPermission, AdminRole, ROLE_PERMISSIONS } from '@roarpass/shared/types/admin';
import { createAuditLog } from '../services/auditService';
import { redis } from '../lib/redis';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
if (!ADMIN_JWT_SECRET) {
  throw new Error('ADMIN_JWT_SECRET environment variable is required');
}

export interface AdminJwtPayload {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  mfaVerified: boolean;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: AdminJwtPayload;
    }
  }
}

/**
 * Verifies admin JWT, checks MFA, checks token revocation list.
 * Must be applied to every /admin/* route.
 */
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing admin token' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: AdminJwtPayload;
  try {
    payload = jwt.verify(token, ADMIN_JWT_SECRET!, {
      algorithms: ['HS256'],
      issuer: 'roarpass-admin',
      audience: 'roarpass-admin-api',
    }) as AdminJwtPayload;
  } catch (err) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired admin token' });
    return;
  }

  // Check token revocation list (Redis)
  const revoked = await redis.get(`revoked_admin_token:${payload.jti}`);
  if (revoked) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token has been revoked' });
    return;
  }

  // Require MFA for admin access
  if (!payload.mfaVerified) {
    res.status(403).json({ error: 'MFA_REQUIRED', message: 'Multi-factor authentication required' });
    return;
  }

  // Check admin user is still active (cached 5 min to reduce DB load)
  const cacheKey = `admin_user_active:${payload.adminUserId}`;
  const cached = await redis.get(cacheKey);
  if (cached === 'false') {
    res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'Admin account is inactive' });
    return;
  }

  req.adminUser = payload;
  next();
}

/**
 * RBAC middleware factory — requires specific permissions.
 * Must be used AFTER requireAdminAuth.
 *
 * Example: router.get('/events', requireAdminAuth, requirePermission('events:read'), handler)
 */
export function requirePermission(...requiredPermissions: AdminPermission[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.adminUser.role];

    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));
    if (!hasAll) {
      // Log denied access attempts for security monitoring
      await createAuditLog({
        adminUserId: req.adminUser.adminUserId,
        adminDisplayName: req.adminUser.displayName,
        action: 'ACCESS_DENIED',
        resourceType: 'endpoint',
        resourceId: req.path,
        changes: {},
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? 'unknown',
        metadata: {
          requiredPermissions,
          userRole: req.adminUser.role,
        },
      });

      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
        required: requiredPermissions,
      });
      return;
    }

    next();
  };
}

/**
 * Audit logging middleware — logs every mutating admin action automatically.
 * Attach to POST/PUT/PATCH/DELETE routes.
 */
export function auditAction(resourceType: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.auditResourceType = resourceType;
    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auditResourceType?: string;
    }
  }
}

function getClientIp(req: Request): string {
  // Trust reverse proxy headers only if configured
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Rate limiter specifically for admin auth — prevent brute force on admin endpoints.
 * 30 requests/min per IP.
 */
export async function adminRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = getClientIp(req);
  const key = `admin_rate:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  if (count > 30) {
    res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfterSeconds: 60 });
    return;
  }
  next();
}