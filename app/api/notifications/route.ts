import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api/http"

/** Enough to fill the bell dropdown. `unreadCount` counts all of them, not just these. */
const NOTIFICATION_PAGE_SIZE = 20

export async function GET() {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response
  const { user } = resolved

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        message: true,
        relatedTicketId: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return Response.json({ notifications, unreadCount })
}
