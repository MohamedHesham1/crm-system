import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/http"
import { NOT_DELETED } from "@/lib/ticket-access"
import { summariseAgents } from "@/lib/report-metrics"

export const GET = withAuth({ role: "admin" }, async () => {
  const [rows, staff] = await Promise.all([
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null }, ...NOT_DELETED },
      select: { createdAt: true, resolvedAt: true, dueAt: true, assignedAgentId: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["AGENT", "ADMIN"] } },
      select: { id: true, name: true },
    }),
  ])

  const names = new Map(staff.map((user) => [user.id, user.name]))

  const agents = summariseAgents(rows.map((row) => ({ ...row, resolvedAt: row.resolvedAt! })))
    .map((agent) => ({
      ...agent,
      // `Ticket.assignedAgent` is `onDelete: SetNull` (`prisma/schema.prisma:78`),
      // so a deleted agent's tickets return to the queue and land in the `null`
      // bucket. An id with no name is therefore a genuinely missing row; fall
      // back to the id so it stays traceable instead of silently vanishing.
      name: agent.agentId === null ? "Unassigned" : (names.get(agent.agentId) ?? agent.agentId),
    }))
    .sort((a, b) => b.resolved - a.resolved)

  return Response.json({ agents })
})
