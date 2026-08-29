import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/api/http"

/** Newest first, capped. Pagination and export are explicitly out of scope. */
const AUDIT_PAGE_SIZE = 100

export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const ticketId = new URL(request.url).searchParams.get("ticketId")

  const logs = await prisma.auditLog.findMany({
    where: ticketId ? { entityType: "Ticket", entityId: ticketId } : {},
    orderBy: { createdAt: "desc" },
    take: AUDIT_PAGE_SIZE,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  })

  return Response.json({ logs })
}
