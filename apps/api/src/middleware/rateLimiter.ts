/**
 * Rate-limiter middleware — enforces per-user per-endpoint limits.
 * Backed by Redis (env: REDIS_URL). Enforced at API-gateway layer.
 * NO secrets stored here.
 */

import type { Request, Response, NextFunction } from 'express';
import { RATE_LIMITS } from '@roarpass/shared/types/platform-foundation';

interface RateLimiterOptions {
  key: string; // key into RATE_LIMITS config, e.g. 'translation.translate'
  /** Optional override per-route */
  overrideConfig?: { windowSeconds: number; maxRequests: number };
}

type RedisClient = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
};

/**
 * Factory — returns an Express middleware function.
 * Requires `req.user.id` to be set by auth middleware upstream.
 */
export function rateLimiter(options: RateLimiterOptions, redis: RedisClient) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId: string | undefined = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Auth required', requestId: req.id ?? 'unknown', timestamp: new Date().toISOString(), statusCode: 401 });
      return;
    }

    const config = options.overrideConfig ?? RATE_LIMITS[options.key];
    if (!config) {
      // No rate limit configured — passthrough
      next();
      return;
    }

    const redisKey = `rl:${options.key}:${userId}`;

    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First request in window — set TTL
      await redis.expire(redisKey, config.windowSeconds);
    }

    const remaining = Math.max(0, config.maxRequests - count);
    const ttl = await redis.ttl(redisKey);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);

    if (count > config.maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        requestId: req.id ?? 'unknown',
        timestamp: new Date().toISOString(),
        statusCode: 429,
        details: { retryAfterSeconds: ttl },
      });
      return;
    }

    next();
  };
}