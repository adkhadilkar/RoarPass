import { createClient } from "redis";
import { getEnv } from "../config/env";

/**
 * Redis-backed JWT JTI revocation denylist.
 * TTL matches the token expiry so the set stays bounded.
 */

const client = createClient({ url: getEnv("REDIS_URL") });
let connected = false;

async function ensureConnected() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
}

export const tokenRevocationStore = {
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    await ensureConnected();
    await client.set(`revoked:jti:${jti}`, "1", { EX: ttlSeconds });
  },

  async has(jti: string): Promise<boolean> {
    await ensureConnected();
    const val = await client.get(`revoked:jti:${jti}`);
    return val !== null;
  },
};