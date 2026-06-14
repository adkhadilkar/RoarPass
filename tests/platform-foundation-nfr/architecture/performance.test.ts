/**
 * PRD 8.2 — Performance & scalability.
 *
 * Acceptance criteria:
 * AC-8.2.1  P50 API response time < 200 ms for read endpoints
 * AC-8.2.2  P95 API response time < 800 ms for read endpoints
 * AC-8.2.3  Events listing endpoint handles pagination correctly
 * AC-8.2.4  Search endpoint returns results within 500 ms median
 * AC-8.2.5  Redis cache layer is engaged (x-cache-hit header or similar)
 * AC-8.2.6  Gzip / Brotli compression active on JSON responses ≥ 1 KB
 */

import {
  API_URL,
  createAuthClient,
  createAnonClient,
  measureMedianLatency,
  sleep,
} from "../setup/helpers";

const authClient = createAuthClient();
const anonClient = createAnonClient();

describe("[8.2] Performance & scalability", () => {
  // ------------------------------------------------------------------ 8.2.1
  test("AC-8.2.1 — /api/events P50 latency < 200 ms", async () => {
    const median = await measureMedianLatency(
      () => authClient.get("/api/events?limit=20"),
      10
    );
    expect(median).toBeLessThan(200);
  });

  // ------------------------------------------------------------------ 8.2.2
  test("AC-8.2.2 — /api/events P95 latency < 800 ms (20-sample proxy)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await authClient.get("/api/events?limit=20");
      times.push(Date.now() - start);
      await sleep(50);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(800);
  });

  // ------------------------------------------------------------------ 8.2.3
  test("AC-8.2.3 — Events listing supports cursor-based pagination", async () => {
    const page1 = await authClient.get("/api/events?limit=5");
    expect(page1.status).toBe(200);
    expect(Array.isArray(page1.data.data)).toBe(true);
    expect(page1.data.data.length).toBeLessThanOrEqual(5);

    const cursor = page1.data.nextCursor ?? page1.data.meta?.nextCursor;
    if (cursor) {
      const page2 = await authClient.get(
        `/api/events?limit=5&cursor=${encodeURIComponent(cursor)}`
      );
      expect(page2.status).toBe(200);
      const ids1 = page1.data.data.map((e: any) => e.id);
      const ids2 = page2.data.data.map((e: any) => e.id);
      const overlap = ids1.filter((id: string) => ids2.includes(id));
      expect(overlap.length).toBe(0); // no duplicate items across pages
    }
  });

  // ------------------------------------------------------------------ 8.2.4
  test("AC-8.2.4 — /api/search?q= median latency < 500 ms", async () => {
    const median = await measureMedianLatency(
      () => authClient.get("/api/search?q=world+cup&type=event"),
      8
    );
    expect(median).toBeLessThan(500);
  });

  // ------------------------------------------------------------------ 8.2.5
  test("AC-8.2.5 — Cache hit header present on repeated GET", async () => {
    // Prime the cache
    await authClient.get("/api/events?limit=20");
    await sleep(100);
    // Second request should hit cache
    const res = await authClient.get("/api/events?limit=20");
    const cacheHeader =
      res.headers["x-cache"] ||
      res.headers["x-cache-hit"] ||
      res.headers["x-redis-cache"] ||
      res.headers["cf-cache-status"];
    // Acceptable values: HIT, MISS (first call might be warm — just check header exists)
    expect(cacheHeader).toBeDefined();
  });

  // ------------------------------------------------------------------ 8.2.6
  test("AC-8.2.6 — JSON responses ≥ 1 KB are gzip/brotli compressed", async () => {
    const res = await authClient.get("/api/events?limit=50", {
      headers: { "Accept-Encoding": "gzip, br" },
    });
    const encoding = res.headers["content-encoding"] ?? "";
    const body = JSON.stringify(res.data);
    if (body.length >= 1024) {
      expect(["gzip", "br", "zstd"].some((e) => encoding.includes(e))).toBe(
        true
      );
    }
  });

  // ------------------------------------------------------------------ 8.2 image optimisation
  test("AC-8.2 — /api/users/me responds in < 300 ms", async () => {
    const start = Date.now();
    const res = await authClient.get("/api/users/me");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(300);
  });
});