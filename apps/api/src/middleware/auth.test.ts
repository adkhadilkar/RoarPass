import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { parseJwt, requireAuth, requireRole, requirePremium } from "./auth";
import type { JwtPayload } from "@roarpass/shared";

const JWT_SECRET = "test-secret-32-chars-xxxxxxxxxxxxxxx";
process.env.JWT_SECRET = JWT_SECRET;

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: "user-uuid",
    roles: ["FAN"],
    subscription: "FREE",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: "jti-1",
    ...overrides,
  };
}

function makeToken(payload: Partial<JwtPayload> = {}) {
  return jwt.sign(makePayload(payload), JWT_SECRET, { algorithm: "HS256" });
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("parseJwt", () => {
  it("sets req.user for a valid token", () => {
    const token = makeToken();
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    parseJwt(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toBeDefined();
    expect((req as any).user.sub).toBe("user-uuid");
  });

  it("calls next without user when no Authorization header", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    parseJwt(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toBeUndefined();
  });

  it("returns 401 for an expired token", () => {
    const token = jwt.sign(makePayload({ exp: 1 }), JWT_SECRET, {
      algorithm: "HS256",
    });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    parseJwt(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a tampered token", () => {
    const token = makeToken() + "tampered";
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    parseJwt(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
  });
});

describe("requireAuth", () => {
  it("calls next when user is set", () => {
    const req = mockReq() as any;
    req.user = makePayload();
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when user is not set", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("allows access when user has required role", () => {
    const req = mockReq() as any;
    req.user = makePayload({ roles: ["ADMIN"] });
    const res = mockRes();
    const next = vi.fn();

    requireRole("ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 403 when user lacks required role", () => {
    const req = mockReq() as any;
    req.user = makePayload({ roles: ["FAN"] });
    const res = mockRes();
    const next = vi.fn();

    requireRole("ADMIN")(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows access if any of the listed roles match", () => {
    const req = mockReq() as any;
    req.user = makePayload({ roles: ["COMMUNITY_MODERATOR"] });
    const res = mockRes();
    const next = vi.fn();

    requireRole("ADMIN", "COMMUNITY_MODERATOR")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe("requirePremium", () => {
  it("allows FAN_PREMIUM users", () => {
    const req = mockReq() as any;
    req.user = makePayload({ subscription: "FAN_PREMIUM" });
    const res = mockRes();
    const next = vi.fn();

    requirePremium(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 402 for FREE tier users", () => {
    const req = mockReq() as any;
    req.user = makePayload({ subscription: "FREE" });
    const res = mockRes();
    const next = vi.fn();

    requirePremium(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(402);
  });
});