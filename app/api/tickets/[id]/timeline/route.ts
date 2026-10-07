import { prisma } from "@/lib/prisma"
import { notFound, withAuth } from "@/lib/api/http"
import { NOT_DELETED } from "@/lib/ticket-access"

export const GET = withAuth(
  { role: "agent", permission: "TICKETS_READ" },
  async (_request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params
    const ticket = await prisma.ticket.findFirst({
      where: { id, ...NOT_DELETED },
      select: {
        id: true,
        subject: true,
        createdAt: true,
        comments: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            body: true,
            isInternal: true,
            createdAt: true,
            author: { select: { id: true, name: true, role: true } },
          },
        },
      },
    })
    if (!ticket) return notFound("Ticket not found.")

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "Ticket", entityId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, action: true, detail: true, createdAt: true },
    })

    const { comments, ...ticketDetails } = ticket
    return Response.json({ timeline: { ticket: ticketDetails, comments, auditLogs } })
  },
)
