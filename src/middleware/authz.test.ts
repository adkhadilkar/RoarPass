import { describe, it, expect, vi } from 'vitest';
import { requireRole } from './authz';
import type { Request, Response, NextFunction } from 'express';

describe('requireRole', () => {
  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  };

  it('returns 401 if user is not authenticated', () => {
    const req = {} as Request;
    const res = mockResponse();
    const next = vi.fn();

    const middleware = requireRole('local_helper');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if user role is below minimum required role', () => {
    const req = { user: { role: 'fan' } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    const middleware = requireRole('local_helper');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'insufficient_role' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if user role is equal to minimum required role', () => {
    const req = { user: { role: 'local_helper' } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    const middleware = requireRole('local_helper');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next if user role is above minimum required role', () => {
    const req = { user: { role: 'platform_admin' } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    const middleware = requireRole('local_helper');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
