import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL env var is not set');
    redis = new Redis(url, { lazyConnect: false });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function getQueueLength(queueName: string): Promise<number> {
  const r = getRedis();
  return r.llen(queueName);
}

export async function peekQueueItem(queueName: string): Promise<Record<string, unknown> | null> {
  const r = getRedis();
  const item = await r.lrange(queueName, 0, 0);
  if (!item.length) return null;
  return JSON.parse(item[0]);
}

export async function waitForQueueDrain(
  queueName: string,
  timeoutMs = 5000,
  pollIntervalMs = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const len = await getQueueLength(queueName);
    if (len === 0) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

/**
 * Wait until a moderation SLA notification appears on the alert queue.
 */
export async function waitForSlaAlert(
  communityId: string,
  itemId: string,
  timeoutMs = 10000,
): Promise<boolean> {
  const r = getRedis();
  const deadline = Date.now() + timeoutMs;
  const key = `sla_alerts:${communityId}`;
  while (Date.now() < deadline) {
    const items = await r.lrange(key, 0, 50);
    for (const raw of items) {
      const parsed = JSON.parse(raw) as { item_id: string };
      if (parsed.item_id === itemId) return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}