import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestEntry {
  timestamp: number;
}

interface Bucket {
  entries: RequestEntry[];
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const store = new Map<string, Bucket>();

// ---------------------------------------------------------------------------
// Preset configuration
// ---------------------------------------------------------------------------

export const RATE_LIMIT_PRESETS = {
  analysis: { limit: 30, windowMs: 60_000 },   // 30 req / min (credit system already limits abuse)
  checkout: { limit: 5, windowMs: 60_000 },    // 5 req / min
  credits:  { limit: 30, windowMs: 60_000 },   // 30 req / min
  default:  { limit: 120, windowMs: 60_000 },  // 120 req / min
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the client IP from standard proxy headers, falling back to
 * "unknown" when no header is available.
 */
function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; the first entry is
    // the original client IP.
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

/**
 * Remove entries from a bucket that are older than `windowMs` and return the
 * number of remaining (valid) entries.
 */
function purgeOldEntries(bucket: Bucket, now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  // Filter in-place to avoid creating a new array every call.
  let writeIdx = 0;
  for (let readIdx = 0; readIdx < bucket.entries.length; readIdx++) {
    if (bucket.entries[readIdx].timestamp > cutoff) {
      bucket.entries[writeIdx++] = bucket.entries[readIdx];
    }
  }
  bucket.entries.length = writeIdx;
  return writeIdx;
}

/**
 * Iterate over the entire store and remove buckets whose entire window has
 * expired, preventing unbounded memory growth.
 */
function purgeExpiredKeys(now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  for (const [key, bucket] of store) {
    if (bucket.entries.length === 0) {
      store.delete(key);
      continue;
    }
    // If the newest entry is older than the window, the whole bucket is stale.
    if (bucket.entries[bucket.entries.length - 1].timestamp < cutoff) {
      store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Core rate-limit function
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limiter.
 *
 * @param request  The incoming NextRequest (used to extract the client IP).
 * @param limit    Maximum number of requests allowed in the window (default 60).
 * @param windowMs Window size in milliseconds (default 60 000 = 1 min).
 * @returns An object with `success`, `remaining`, and `resetAt`.
 */
export function rateLimit(
  request: NextRequest,
  limit: number = RATE_LIMIT_PRESETS.default.limit,
  windowMs: number = RATE_LIMIT_PRESETS.default.windowMs,
): { success: boolean; remaining: number; resetAt: number } {
  const ip = extractIp(request);
  const now = Date.now();
  const key = `${ip}:${limit}:${windowMs}`;

  // -----------------------------------------------------------------------
  // Auto-cleanup: prune stale buckets periodically (every call is fine –
  // the iteration is cheap for typical traffic patterns).
  // -----------------------------------------------------------------------
  purgeExpiredKeys(now, windowMs);

  // -----------------------------------------------------------------------
  // Get or create bucket
  // -----------------------------------------------------------------------
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { entries: [] };
    store.set(key, bucket);
  }

  // -----------------------------------------------------------------------
  // Remove entries outside the sliding window
  // -----------------------------------------------------------------------
  const currentCount = purgeOldEntries(bucket, now, windowMs);

  // -----------------------------------------------------------------------
  // Determine the earliest reset time (timestamp of the oldest entry in the
  // window + windowMs). If there are no entries, reset is effectively now.
  // -----------------------------------------------------------------------
  const resetAt =
    bucket.entries.length > 0
      ? bucket.entries[0].timestamp + windowMs
      : now + windowMs;

  // -----------------------------------------------------------------------
  // Check against limit
  // -----------------------------------------------------------------------
  if (currentCount >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt,
    };
  }

  // Record this request
  bucket.entries.push({ timestamp: now });

  return {
    success: true,
    remaining: limit - currentCount - 1,
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// withRateLimit helper
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that returns `null` when the request is allowed and a
 * 429 NextResponse when the rate limit has been exceeded.
 */
export function withRateLimit(
  request: NextRequest,
  limit?: number,
  windowMs?: number,
): NextResponse | null {
  const result = rateLimit(request, limit, windowMs);

  if (result.success) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      resetAt: result.resetAt,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetAt),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Preset convenience functions
// ---------------------------------------------------------------------------

/** Rate limit for AI analysis endpoints – 10 requests per minute per IP. */
export function rateLimitAnalysis(request: NextRequest) {
  return rateLimit(
    request,
    RATE_LIMIT_PRESETS.analysis.limit,
    RATE_LIMIT_PRESETS.analysis.windowMs,
  );
}

/** Rate limit for checkout endpoints – 5 requests per minute per IP. */
export function rateLimitCheckout(request: NextRequest) {
  return rateLimit(
    request,
    RATE_LIMIT_PRESETS.checkout.limit,
    RATE_LIMIT_PRESETS.checkout.windowMs,
  );
}

/** Rate limit for credits endpoints – 30 requests per minute per IP. */
export function rateLimitCredits(request: NextRequest) {
  return rateLimit(
    request,
    RATE_LIMIT_PRESETS.credits.limit,
    RATE_LIMIT_PRESETS.credits.windowMs,
  );
}
