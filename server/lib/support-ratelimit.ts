import { db } from "../db";
import { supportRateLimitBuckets } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

/**
 * Postgres-backed sliding-window rate limiter. Records every hit with a
 * timestamp keyed on `bucketKey`. Old rows are filtered by time. A best-effort
 * cleanup runs occasionally to keep the table small.
 */
export async function rateLimitDb(bucketKey: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportRateLimitBuckets)
    .where(and(eq(supportRateLimitBuckets.bucketKey, bucketKey), gte(supportRateLimitBuckets.hitAt, since)));
  if ((count || 0) >= max) return false;
  await db.insert(supportRateLimitBuckets).values({ bucketKey });
  // Best-effort cleanup ~1% of the time
  if (Math.random() < 0.01) {
    void db.delete(supportRateLimitBuckets).where(sql`${supportRateLimitBuckets.hitAt} < now() - interval '1 hour'`);
  }
  return true;
}

export function getClientIp(req: Request): string {
  return (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
}

/** Express middleware factory that applies a DB-backed rate limit per IP. */
export function rateLimitMiddleware(opts: {
  bucket: string;
  max: number;
  windowMs: number;
  keyFn?: (req: Request) => string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subKey = opts.keyFn ? opts.keyFn(req) : getClientIp(req);
      const ok = await rateLimitDb(`${opts.bucket}:${subKey}`, opts.max, opts.windowMs);
      if (!ok) return res.status(429).json({ error: "Too many requests. Please try again shortly." });
      next();
    } catch (err) {
      // Fail-open on infrastructure failure rather than blocking the world.
      console.warn("[rate-limit] failed:", err);
      next();
    }
  };
}
