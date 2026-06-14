import type { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env";

/**
 * Applies security headers to every response.
 * Satisfies: PRD §8.3, OWASP Secure Headers Project.
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const isDev = getEnv("NODE_ENV") === "development";

  // Content-Security-Policy
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // needed for CSS-in-JS; tighten post-MVP
    "img-src 'self' data: https://cdn.roarpass.com https://res.cloudinary.com",
    "font-src 'self' https://cdn.roarpass.com",
    "connect-src 'self' https://api.roarpass.com wss://rt.roarpass.com",
    "media-src 'self' https://cdn.roarpass.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join("; ");

  res.setHeader("Content-Security-Policy", cspDirectives);

  // HSTS — only enforce in production to avoid breaking localhost dev
  if (!isDev) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(self), payment=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Remove fingerprinting headers
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  next();
}