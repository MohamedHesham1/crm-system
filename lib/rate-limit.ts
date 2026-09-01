/**
 * A sliding-window attempt counter held in **process memory**. Deliberately not
 * Redis: this application runs as a single Node process, and an eleventh story
 * on a project this size does not get to add an infrastructure dependency. Two
 * consequences are accepted, not overlooked: the counters reset on deploy, and
 * a multi-instance deployment would give each instance its own budget.
 */
export type RateLimitRule = {
  /** Attempts allowed inside `windowMs`. */
  limit: number
  windowMs: number
}

export const RATE_LIMITS = {
  /** `POST /api/register`. Generous enough that a person fixing a typo never sees it. */
  register: { limit: 5, windowMs: 10 * 60 * 1000 },
  /** The credentials `authorize()`. Only **failed** attempts are recorded. */
  login: { limit: 10, windowMs: 5 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Cap on distinct keys. Without it, a `Map` keyed by a request header is an
 * unbounded allocation an attacker controls. At the cap the oldest key is
 * dropped — the worst case is that one attacker regains a few attempts, which
 * is strictly better than the process dying.
 */
const MAX_KEYS = 5_000

const hits = new Map<string, number[]>()

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number }

/**
 * Reads the counter **without** recording an attempt. Callers that want to
 * charge the attempt call `recordAttempt` afterwards — which is what lets the
 * login path charge failures only.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): RateLimitVerdict {
  const cutoff = now - rule.windowMs
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff)

  if (recent.length === 0) hits.delete(key)
  else hits.set(key, recent)

  if (recent.length < rule.limit) return { ok: true }

  const oldest = recent[0]
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
  }
}

export function recordAttempt(key: string, now = Date.now()): void {
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    const oldestKey = hits.keys().next().value
    if (oldestKey !== undefined) hits.delete(oldestKey)
  }
  hits.set(key, [...(hits.get(key) ?? []), now])
}

/** Test seam. Called from `tests/setup/api.ts`'s `beforeEach`, never from application code. */
export function resetRateLimits(): void {
  hits.clear()
}

/**
 * There is no `request.ip` in Next 16 — a proxy header is the only source. A
 * deployment that sets neither header puts every caller in one `"unknown"`
 * bucket; see the plan's Edge Cases section.
 */
export function clientIp(request: Request | undefined): string {
  const forwarded = request?.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request?.headers.get("x-real-ip")?.trim() || "unknown"
}
