import { z, type ZodError } from "zod"

import { auth } from "@/auth"
import { isStaff } from "@/lib/roles"

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
