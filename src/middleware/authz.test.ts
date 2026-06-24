import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminScope } from './authz';
import { Request, Response, NextFunction } from 'express';

describe('requireAdminScope middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFunction = vi.fn();
  });

  it('should return 401 if user is not authenticated', () => {
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 403 if user has insufficient role rank', () => {
    mockReq.user = { id: 'user-1', role: 'fan' } as any;
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'insufficient_role' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next if role is sufficient and no community id check applies (e.g., local_helper vs local_helper)', () => {
    mockReq.user = { id: 'user-1', role: 'local_helper' } as any;
    const middleware = requireAdminScope('local_helper');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next for community_admin requesting matching community ID', () => {
    mockReq.user = { id: 'admin-1', role: 'community_admin', communityId: 'comm-123' } as any;
    mockReq.params = { communityId: 'comm-123' };
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 403 for community_admin requesting mismatching community ID', () => {
    mockReq.user = { id: 'admin-1', role: 'community_admin', communityId: 'comm-123' } as any;
    mockReq.params = { communityId: 'comm-456' };
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'community_scope_violation' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next for community_admin requesting without community ID params', () => {
    mockReq.user = { id: 'admin-1', role: 'community_admin', communityId: 'comm-123' } as any;
    mockReq.params = {};
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next for platform_admin bypassing community check', () => {
    mockReq.user = { id: 'admin-1', role: 'platform_admin' } as any;
    mockReq.params = { communityId: 'comm-456' }; // Different community
    const middleware = requireAdminScope('community_admin');

    middleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
