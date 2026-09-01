import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/http"

/** Enough to fill the bell dropdown. `unreadCount` counts all of them, not just these. */
const NOTIFICATION_PAGE_SIZE = 20

export const GET = withAuth({ role: "user" }, async (_request, _ctx, user) => {
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
})
