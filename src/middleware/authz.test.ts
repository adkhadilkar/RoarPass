import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireRole, requireAdminScope, Role } from './authz';

function mockReq(overrides: Partial<any> = {}): Request {
  return { params: {}, ...overrides } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe('requireRole', () => {
  it('returns 401 if user is not authenticated', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireRole('community_admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if user has insufficient role', () => {
    const req = mockReq({ user: { role: 'fan' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole('community_admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'insufficient_role' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if user has sufficient role', () => {
    const req = mockReq({ user: { role: 'platform_admin' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole('community_admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next if user has exact required role', () => {
    const req = mockReq({ user: { role: 'community_admin' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole('community_admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireAdminScope', () => {
  it('returns 401 if user is not authenticated', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if user has insufficient role', () => {
    const req = mockReq({ user: { role: 'local_helper' } });
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'insufficient_role' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if community_admin accesses a different communityId', () => {
    const req = mockReq({
      user: { role: 'community_admin', communityId: 'comm-1' },
      params: { communityId: 'comm-2' },
    });
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'community_scope_violation' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if community_admin accesses their own communityId', () => {
    const req = mockReq({
      user: { role: 'community_admin', communityId: 'comm-1' },
      params: { communityId: 'comm-1' },
    });
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next if community_admin accesses route without communityId param', () => {
    const req = mockReq({
      user: { role: 'community_admin', communityId: 'comm-1' },
      params: {},
    });
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next for platform_admin regardless of communityId', () => {
    const req = mockReq({
      user: { role: 'platform_admin' },
      params: { communityId: 'comm-2' },
    });
    const res = mockRes();
    const next = vi.fn();

    requireAdminScope('community_admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
