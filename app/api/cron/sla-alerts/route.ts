import { timingSafeEqual } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/http"
import { slaBreachedWhere } from "@/lib/sla"
import { NOT_DELETED } from "@/lib/ticket-access"

function hasValidBearerToken(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return false

  const token = Buffer.from(authorization.slice("Bearer ".length))
  const expected = Buffer.from(secret)
  return token.length === expected.length && timingSafeEqual(token, expected)
}

export const POST = withAuth({ role: "public" }, async (request) => {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: "Cron endpoint is not configured." }, { status: 500 })
  }
  if (!hasValidBearerToken(request, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const tickets = await prisma.ticket.findMany({
    where: {
      ...slaBreachedWhere(now),
      ...NOT_DELETED,
      assignedAgentId: { not: null },
    },
    select: { id: true, subject: true, dueAt: true, assignedAgentId: true },
  })

  for (const ticket of tickets) {
    if (!ticket.dueAt || !ticket.assignedAgentId) continue

    const dedupeKey = `SLA_BREACHED:${ticket.id}:${ticket.assignedAgentId}:${ticket.dueAt.toISOString()}`
    await prisma.notification.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        dedupeKey,
        userId: ticket.assignedAgentId,
        type: "SLA_BREACHED",
        message: `SLA breached for "${ticket.subject}".`,
        relatedTicketId: ticket.id,
      },
    })
  }

  return Response.json({ checked: tickets.length })
})
