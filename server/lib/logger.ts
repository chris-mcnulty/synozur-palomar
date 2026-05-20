/**
 * Minimal structured logger. JSON-on-one-line in production, human-friendly
 * in development. No external dependency — the goal here is to make logs
 * grep-able and pipeable to a downstream aggregator (ELK, Datadog, etc.)
 * without rewriting every console.log in the codebase.
 *
 * Use the request-scoped `req.log` (attached by the middleware in
 * server/index.ts) when you have a request — it carries the correlation
 * ID, user, tenant, and route automatically. Use the bare `logger` for
 * job/scheduler code that has no request context.
 */

import type { Request } from "express";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const IS_PROD = process.env.NODE_ENV === "production";

export interface LogContext {
  requestId?: string;
  userId?: string | null;
  tenantId?: string | null;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, extra?: LogContext): void;
  info(msg: string, extra?: LogContext): void;
  warn(msg: string, extra?: LogContext): void;
  error(msg: string, extra?: LogContext): void;
  child(ctx: LogContext): Logger;
}

function emit(level: LogLevel, msg: string, ctx: LogContext): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[currentLevel()]) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  };
  // Avoid circular refs; truncate massive blobs.
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({ ts: record.ts, level, msg, _serializeError: true });
  }
  // Truncating mid-line produces invalid JSON and breaks downstream parsers.
  // Replace oversized lines with a fresh well-formed record that flags the
  // truncation so log ingestion still works.
  if (line.length > 16_000) {
    line = JSON.stringify({
      ts: record.ts,
      level,
      msg,
      _truncated: true,
      _originalLength: line.length,
    });
  }
  if (IS_PROD || process.env.LOG_JSON === "1") {
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  } else {
    // Pretty mode for dev — keep the JSON record at the end for grepping.
    const tag = level.toUpperCase().padEnd(5);
    const where = ctx.requestId ? ` [${String(ctx.requestId).slice(0, 8)}]` : "";
    const status = ctx.statusCode ? ` ${ctx.statusCode}` : "";
    const dur = ctx.durationMs != null ? ` ${ctx.durationMs}ms` : "";
    const route = ctx.method && ctx.path ? ` ${ctx.method} ${ctx.path}` : "";
    const out = `${tag}${where}${route}${status}${dur} — ${msg}`;
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
  }
}

function makeLogger(base: LogContext): Logger {
  const ctx = { ...base };
  return {
    debug: (msg, extra) => emit("debug", msg, { ...ctx, ...(extra || {}) }),
    info: (msg, extra) => emit("info", msg, { ...ctx, ...(extra || {}) }),
    warn: (msg, extra) => emit("warn", msg, { ...ctx, ...(extra || {}) }),
    error: (msg, extra) => emit("error", msg, { ...ctx, ...(extra || {}) }),
    child: (extra) => makeLogger({ ...ctx, ...extra }),
  };
}

export const logger: Logger = makeLogger({});

/** Pull the request-scoped logger off Express's `req`, falling back to root. */
export function reqLogger(req: Request | undefined | null): Logger {
  const attached = (req as any)?.log as Logger | undefined;
  return attached || logger;
}

/** Build a serializable error payload that won't blow the log line up. */
export function serializeError(err: unknown): LogContext {
  if (err instanceof Error) {
    return {
      errName: err.name,
      errMessage: err.message,
      errStack: err.stack ? err.stack.split("\n").slice(0, 8).join("\n") : undefined,
    };
  }
  return { errMessage: String(err) };
}
