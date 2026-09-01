import { z, type ZodError } from "zod"

import { auth } from "@/auth"
import { checkRateLimit, clientIp, recordAttempt, type RateLimitRule } from "@/lib/rate-limit"
import { isStaff, type Role } from "@/lib/roles"
import { resolveViewer, type Viewer } from "@/lib/ticket-access"

/**
 * `middleware.ts` excludes `/api/**` (see its matcher at line 37), so every
 * route handler must guard itself. Returns a `Response` to send back, or
 * `null` when the caller is authenticated staff (AGENT or ADMIN).
 */
export async function requireAgent(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isStaff(session.user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

/** Same shape as `requireAgent`, narrowed to ADMIN. Guards `/api/admin/**`. */
export async function requireAdmin(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

/**
 * Any authenticated caller, with the identity attached. Used by
 * `/api/notifications/**`, which is scoped by `userId` rather than by role: a
 * CUSTOMER hitting it gets an empty list, not a `403`. Same
 * `{ ok } | { response }` shape as `readJson` and `resolveViewer`.
 */
export async function requireUser(): Promise<
  | { ok: true; user: { id: string; name: string; role: Role } }
  | { ok: false; response: Response }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const name = session.user.name ?? "Unknown user"
  return { ok: true, user: { id: session.user.id, name, role: session.user.role } }
}

export function validationError<T>(error: ZodError<T>): Response {
  const { fieldErrors, formErrors } = z.flattenError(error)
  return Response.json({ error: "Validation failed", fieldErrors, formErrors }, { status: 400 })
}

export function notFound(message: string): Response {
  return Response.json({ error: message }, { status: 404 })
}

/** Reads a JSON body without letting a malformed payload become a 500. */
export async function readJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await request.json() }
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    }
  }
}

export type AuthRole = "public" | "user" | "agent" | "admin" | "viewer"

/** What the wrapped handler receives as its third argument, per role. */
type AuthPayloads = {
  public: null
  user: { id: string; name: string; role: Role }
  agent: { id: string; name: string; role: Role }
  admin: { id: string; name: string; role: Role }
  viewer: Viewer
}

export type AuthOptions<R extends AuthRole> = {
  /**
   * **Required.** This is the whole point of the wrapper: a handler cannot be
   * exported without answering "who may call this?", so a forgotten guard is a
   * type error rather than an open endpoint. `"public"` is a deliberate,
   * greppable declaration — not the absence of one.
   */
  role: R
  /** Per-IP throttle, applied before the role check and before any database work. */
  rateLimit?: RateLimitRule
}

/**
 * Wraps a route handler with its authorisation declaration.
 *
 * This adds **no new authorisation logic**. `requireAgent()`, `requireAdmin()`,
 * `requireUser()` and `resolveViewer()` keep their signatures and their bodies;
 * this decides which one to call and hands the result to the handler, so no
 * route's outcome changes. What changes is that the decision is part of the
 * export rather than the first two lines of the body.
 */
export function withAuth<R extends AuthRole, C = unknown>(
  options: AuthOptions<R>,
  handler: (request: Request, ctx: C, auth: AuthPayloads[R]) => Promise<Response>,
): (request?: Request, ctx?: C) => Promise<Response> {
  return async (request?: Request, ctx?: C): Promise<Response> => {
    // Next always passes both. `tests/api/customers.test.ts:27` calls the
    // export as `GET()` — no request, no ctx — so both are optional here and
    // normalised before use; the inner `handler` keeps non-nullable
    // parameters rather than every route re-deriving this.
    const req = request ?? new Request("http://localhost/")

    if (options.rateLimit) {
      const key = `${new URL(req.url).pathname}:${clientIp(req)}`
      const verdict = checkRateLimit(key, options.rateLimit)
      if (!verdict.ok) return tooManyRequests(verdict.retryAfterSeconds)
      recordAttempt(key)
    }

    if (options.role === "public") {
      return handler(req, ctx as C, null as AuthPayloads[R])
    }

    if (options.role === "viewer") {
      const resolved = await resolveViewer()
      if (!resolved.ok) return resolved.response
      return handler(req, ctx as C, resolved.viewer as AuthPayloads[R])
    }

    if (options.role === "admin") {
      const denied = await requireAdmin()
      if (denied) return denied
    } else if (options.role === "agent") {
      const denied = await requireAgent()
      if (denied) return denied
    }

    // `requireAgent`/`requireAdmin` return Response-or-null and carry no
    // identity, so the caller is resolved once more here. That is a second
    // `auth()` call on staff routes; see the plan's Edge Cases.
    const identity = await requireUser()
    if (!identity.ok) return identity.response
    return handler(req, ctx as C, identity.user as AuthPayloads[R])
  }
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many attempts. Try again in a few minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  )
}
