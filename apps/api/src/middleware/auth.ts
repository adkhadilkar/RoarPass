import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload, UserRole } from "@roarpass/shared";
import { createApiError, HTTP_STATUS } from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 * Validates the Bearer token, checks expiry, and attaches the decoded
 * payload to req.user.  Does NOT verify against a revocation list here
 * (that is done in requireAuth for performance-sensitive paths).
 */
export function parseJwt(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createApiError("INTERNAL_ERROR", "JWT secret not configured", req)
    );
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createApiError("UNAUTHORIZED", "Token expired", req)
      );
    } else {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createApiError("UNAUTHORIZED", "Invalid token", req)
      );
    }
  }
}

/**
 * Middleware that enforces the request is authenticated.
 * Must be used after parseJwt.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createApiError("UNAUTHORIZED", "Authentication required", req)
    );
    return;
  }
  next();
}

/**
 * Factory: enforce that the authenticated user has at least one of the
 * specified roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createApiError("UNAUTHORIZED", "Authentication required", req)
      );
      return;
    }

    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      res.status(HTTP_STATUS.FORBIDDEN).json(
        createApiError(
          "FORBIDDEN",
          `Requires one of roles: ${roles.join(", ")}`,
          req
        )
      );
      return;
    }

    next();
  };
}

/**
 * Middleware enforcing FAN_PREMIUM subscription tier.
 * Returns 402 Payment Required with PREMIUM_REQUIRED code on failure.
 */
export function requirePremium(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createApiError("UNAUTHORIZED", "Authentication required", req)
    );
    return;
  }

  if (req.user.subscription !== "FAN_PREMIUM" && req.user.subscription !== "HELPER_PRO") {
    res.status(402).json(
      createApiError("PREMIUM_REQUIRED", "Fan Premium subscription required", req)
    );
    return;
  }

  next();
}