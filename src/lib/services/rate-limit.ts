import "server-only";

/**
 * Tiny in-memory sliding-window limiter. BEST-EFFORT ONLY: on serverless each instance has its own
 * memory and instances come and go, so this throttles bursts from one client, not a distributed attack.
 * (For stronger guarantees use Vercel Firewall rate-limit rules or a shared store such as Upstash.)
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000)) };
    }
    recent.push(now);
    hits.set(key, recent);
    // Keep memory bounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
    return { ok: true };
  };
}
