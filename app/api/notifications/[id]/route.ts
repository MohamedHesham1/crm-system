import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { markNotificationSchema } from "@/lib/validation/notification"

export const PATCH = withAuth(
  { role: "user" },
  async (request, ctx: RouteContext<"/api/notifications/[id]">, user) => {
    const { id } = await ctx.params

    const body = await readJson(request)
    if (!body.ok) return body.response

    const parsed = markNotificationSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    // Ownership lives **inside the `where`**, the same rule `lib/ticket-access.ts`
    // establishes for tickets: someone else's notification id is
    // indistinguishable from a nonexistent one. No `findUnique` followed by an
    // ownership `if`, and no `403` — a `403` would itself confirm the row exists.
    const { count } = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: parsed.data.read },
    })
    if (count === 0) return notFound("Notification not found.")

    return Response.json({ ok: true })
  },
)
