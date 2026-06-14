import type { Request, Response, NextFunction } from "express";
import { jwtVerify, type JWTPayload as JosePayload } from "jose";
import { z } from "zod";
import { JWTPayload, UserRole } from "@roarpass/shared";
import { createAuditLog } from "../services/audit.service";
import { getEnv } from "../config/env";

/**
 * Decodes and verifies a signed JWT from the Authorization header.
 * Populates req.user on success.
 * NEVER logs the raw token.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "MISSING_AUTH_TOKEN" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(getEnv("JWT_SECRET"));
    const { payload } = await jwtVerify(token, secret, {
      issuer: "roarpass",
      audience: getEnv("JWT_AUDIENCE"),
    });

    // Validate shape against our shared contract
    const parsed = JWTPayload.parse(payload);

    // Check if token JTI is revoked (denylist check)
    const isRevoked = await isTokenRevoked(parsed.jti);
    if (isRevoked) {
      res.status(401).json({ error: "TOKEN_REVOKED" });
      return;
    }

    (req as AuthedRequest).user = parsed;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(401).json({ error: "INVALID_TOKEN_SHAPE" });
    } else {
      res.status(401).json({ error: "INVALID_TOKEN" });
    }
  }
}

/**
 * Require all of the given roles (at least one must be present).
 */
export function requireRole(
  ...roles: Array<UserRole>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }
    const hasRole = roles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      createAuditLog({
        event: "AUTH_FORBIDDEN",
        user_id: user.sub,
        required_roles: roles,
        actual_roles: user.roles,
        path: req.path,
      }).catch(console.error);
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    next();
  };
}

/**
 * Checks that the authenticated user's sub matches the route :userId param
 * or that the user has the ADMIN role (owner-or-admin gate).
 */
export function requireOwnerOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthedRequest).user;
  const paramUserId = req.params["userId"];

  if (!user) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }
  const isOwner = user.sub === paramUserId;
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}

// ─── Token Revocation (JTI denylist) ─────────────────────────────────────

async function isTokenRevoked(jti: string): Promise<boolean> {
  // Delegates to the revocation store (Redis). Imported lazily to avoid
  // circular deps; the actual store is injected by the DI container.
  const { tokenRevocationStore } = await import("../stores/token-revocation.store");
  return tokenRevocationStore.has(jti);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthedRequest extends Request {
  user: import("@roarpass/shared").JWTPayload;
}