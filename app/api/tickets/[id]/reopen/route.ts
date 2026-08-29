import { prisma } from "@/lib/prisma"
import { notFound } from "@/lib/api/http"
import { isSlaBreached } from "@/lib/sla"
import { resolveViewer } from "@/lib/ticket-access"

const TICKET_DETAIL_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  dueAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, email: true, company: true } },
  assignedAgent: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  },
} as const

/** Takes no request body. Exists only so "reopen" is a distinct action, not a status value PATCH happens to accept. */
export async function POST(_request: Request, ctx: RouteContext<"/api/tickets/[id]/reopen">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  if (viewer.kind !== "staff") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const current = await prisma.ticket.findUnique({ where: { id }, select: { status: true } })
  if (!current) return notFound("Ticket not found.")

  if (current.status !== "CLOSED") {
    return Response.json({ error: "This ticket is not closed." }, { status: 409 })
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { status: "OPEN" },
    select: TICKET_DETAIL_SELECT,
  })

  return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
}
