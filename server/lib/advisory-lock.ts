/**
 * Postgres session-scoped advisory locks for single-runner job coordination.
 *
 * Background jobs (SLA breach watcher, etc.) currently assume a single Node
 * process. If multiple instances start in parallel they will all fire at the
 * same cron tick, double-emailing recipients and racing on ticket updates.
 *
 * `withAdvisoryLock(key, fn)` wraps a job body with `pg_try_advisory_lock` so
 * that only one runner acquires the named lock; the rest exit fast. The lock
 * is released in a `finally` so a crashing job doesn't strand the lock —
 * advisory locks held on connections are also released when the connection
 * dies, which Neon does between operations on serverless drivers.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Convert an arbitrary string key into the (int, int) pair that
 * `pg_try_advisory_lock(key1, key2)` expects. We compute two independent
 * 32-bit hashes (djb2 and sdbm) — collision risk is low enough for our
 * job-lock use case, and avoiding bigint keeps this portable to older TS
 * targets.
 */
function keyToInts(key: string): { k1: number; k2: number } {
  let hDjb2 = 5381;
  let hSdbm = 0;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    // djb2: h = ((h << 5) + h) + ch  (i.e. h * 33 + ch)
    hDjb2 = ((hDjb2 << 5) + hDjb2 + ch) | 0;
    // sdbm: h = ch + (h << 6) + (h << 16) - h
    hSdbm = (ch + (hSdbm << 6) + (hSdbm << 16) - hSdbm) | 0;
  }
  // Both hashes are already 32-bit signed ints (|0 forces int32), so they
  // satisfy pg_try_advisory_lock's int4 argument requirement directly.
  return { k1: hDjb2, k2: hSdbm };
}

export async function tryAcquireAdvisoryLock(key: string): Promise<boolean> {
  const { k1, k2 } = keyToInts(key);
  try {
    const result = await db.execute(sql`SELECT pg_try_advisory_lock(${k1}, ${k2}) AS got`);
    const row: any = ((result as any).rows || result)[0];
    return !!row?.got;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ADVISORY-LOCK] tryAcquire failed for ${key}: ${msg}`);
    // On the serverless Neon driver, advisory locks aren't always supported on
    // pooled connections. Fail open: callers that don't get the lock will run
    // anyway. This is safe because the SLA breach watcher already dedupes by
    // checking activity log for prior breach entries before sending alerts.
    return true;
  }
}

export async function releaseAdvisoryLock(key: string): Promise<void> {
  const { k1, k2 } = keyToInts(key);
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${k1}, ${k2})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ADVISORY-LOCK] release failed for ${key}: ${msg}`);
  }
}

export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const acquired = await tryAcquireAdvisoryLock(key);
  if (!acquired) return { acquired: false };
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await releaseAdvisoryLock(key);
  }
}

/**
 * Run `fn` with exponential backoff on transient failures. Used by job code
 * that talks to Postgres / SendGrid / Graph — each of which has occasional
 * 5xx / timeout responses that succeed on retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; tag?: string } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = Math.max(50, opts.baseMs ?? 250);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * baseMs);
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.tag) console.warn(`[RETRY:${opts.tag}] attempt ${i + 1}/${attempts} failed (${msg}); retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
