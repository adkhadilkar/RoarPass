import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  user_id: string;
  email: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    const payload = jwt.verify(token, secret) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user?.roles?.includes('ADMIN')) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  });
}