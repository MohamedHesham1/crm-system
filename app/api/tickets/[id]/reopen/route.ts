import { logActivity, notify } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { notFound } from "@/lib/api/http"
import { isSlaBreached } from "@/lib/sla"
import { TICKET_DETAIL_SELECT } from "@/lib/ticket-select"
import { resolveViewer } from "@/lib/ticket-access"

/** Takes no request body. Exists only so "reopen" is a distinct action, not a status value PATCH happens to accept. */
export async function POST(_request: Request, ctx: RouteContext<"/api/tickets/[id]/reopen">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  if (viewer.kind !== "staff") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const current = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true, status: true, assignedAgentId: true },
  })
  if (!current) return notFound("Ticket not found.")

  if (current.status !== "CLOSED") {
    return Response.json({ error: "This ticket is not closed." }, { status: 409 })
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: { status: "OPEN", resolvedAt: null },
      select: TICKET_DETAIL_SELECT,
    })

    await logActivity(tx, [
      {
        entityType: "Ticket",
        entityId: id,
        action: "REOPENED",
        actorId: viewer.id,
        detail: `Reopened by ${viewer.name}.`,
      },
    ])

    await notify(
      tx,
      viewer.id,
      current.assignedAgentId === null
        ? []
        : [
            {
              userId: current.assignedAgentId,
              type: "TICKET_ASSIGNED",
              message: `${viewer.name} reopened "${current.subject}", still assigned to you.`,
              relatedTicketId: id,
            },
          ],
    )

    return updated
  })

  return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
}
