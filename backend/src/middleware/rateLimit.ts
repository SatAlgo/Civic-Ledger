import type { Request, Response, NextFunction } from 'express';

/**
 * Lightweight in-memory rate limiter keyed by user id.
 *
 * For single-instance deployments this is fine. If you scale horizontally,
 * swap the Map for a Redis-backed store; the interface stays the same.
 *
 * Sliding-window approach: keep timestamps of recent requests, drop ones
 * outside the window before counting.
 */
interface Bucket {
  timestamps: number[];
}

type Store = Map<string, Bucket>;
const stores = new Map<string, Store>();

function getStore(name: string): Store {
  let s = stores.get(name);
  if (!s) {
    s = new Map();
    stores.set(name, s);
  }
  return s;
}

interface RateLimitOptions {
  /** Logical name — used to keep separate buckets per endpoint */
  name: string;
  /** Max requests in the window */
  limit: number;
  /** Window length in seconds */
  windowSec: number;
}

export function rateLimit(opts: RateLimitOptions) {
  const store = getStore(opts.name);
  const windowMs = opts.windowSec * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    // Require auth — we key on user id. If no user, just skip (auth middleware
    // will reject before this in practice; this is defensive).
    const key = req.user?._id?.toString();
    if (!key) return next();

    const now = Date.now();
    const bucket = store.get(key) ?? { timestamps: [] };
    // Drop expired timestamps
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= opts.limit) {
      const retryAfterMs = windowMs - (now - bucket.timestamps[0]);
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        error: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      });
    }

    bucket.timestamps.push(now);
    store.set(key, bucket);
    next();
  };
}
