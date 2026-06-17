import { describe, it, expect, vi } from 'vitest';
import { requireRole, Role } from './authz';
import { Request, Response, NextFunction } from 'express';

describe('requireRole middleware', () => {
  it('should return 401 if user is not authenticated', () => {
    const middleware = requireRole('local_helper');
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user has lower role than required', () => {
    const middleware = requireRole('community_admin');
    const req = {
      user: { role: 'local_helper' },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'insufficient_role' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if user has exact required role', () => {
    const middleware = requireRole('community_admin');
    const req = {
      user: { role: 'community_admin' },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should call next if user has higher role than required', () => {
    const middleware = requireRole('local_helper');
    const req = {
      user: { role: 'platform_admin' },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
