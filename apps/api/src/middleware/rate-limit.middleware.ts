import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";
import { getEnv } from "../config/env";

// Lazily created Redis client shared across limiters
let _redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (!_redisClient) {
    _redisClient = createClient({ url: getEnv("REDIS_URL") });
    _redisClient.connect().catch(console.error);
  }
  return _redisClient;
}

function makeStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      getRedisClient().sendCommand(args) as Promise<unknown>,
    prefix,
  });
}

/** Generic API rate limiter — 300 req / 15 min per IP */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:global:"),
  message: { error: "RATE_LIMIT_EXCEEDED" },
});

/** Auth endpoints — tighter to prevent brute-force */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:auth:"),
  message: { error: "AUTH_RATE_LIMIT_EXCEEDED" },
});

/** Translation on-demand — 100 req / min per user (PRD §8.3) */
export const translationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as import("./auth.middleware").AuthedRequest).user?.sub ?? req.ip ?? "anon",
  store: makeStore("rl:translate:"),
  message: { error: "RATE_LIMIT_EXCEEDED", retry_after_seconds: 60 },
});

/** AI assistant — 100 queries / hour per user (REQ-AI-28) */
export const aiAssistantRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as import("./auth.middleware").AuthedRequest).user?.sub ?? req.ip ?? "anon",
  store: makeStore("rl:ai:"),
  message: { error: "RATE_LIMIT_EXCEEDED", retry_after_seconds: 3600 },
});