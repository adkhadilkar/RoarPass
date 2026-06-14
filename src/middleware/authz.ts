import { Request, Response, NextFunction } from 'express';

export type Role = 'fan' | 'local_helper' | 'community_admin' | 'platform_admin';

// Shared contract: keep role hierarchy consistent across all chunks.
const ROLE_RANK: Record<Role, number> = {
  fan: 0,
  local_helper: 1,
  community_admin: 2,
  platform_admin: 3,
};

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'insufficient_role' });
    }
    next();
  };
}

// Admin analytics requires platform_admin OR community_admin scoped to own community.
// Both intents preserved: console branch added requireRole; analytics branch added scope check.
export function requireAdminScope(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'insufficient_role' });
    }
    // community_admin is restricted to their own community's analytics
    if (
      user.role === 'community_admin' &&
      req.params.communityId &&
      req.params.communityId !== user.communityId
    ) {
      return res.status(403).json({ error: 'community_scope_violation' });
    }
    next();
  };
}