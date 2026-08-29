import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/api/http"
import { isSlaHalfElapsed } from "@/lib/sla"

/**
 * Manual admin action — there is no scheduler in this story. A cron or queue
 * worker that calls this on a timer is the deferred follow-up.
 */
export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  const candidateTickets = await prisma.ticket.findMany({
    where: { assignedAgentId: null, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { not: null } },
    select: { id: true, createdAt: true, dueAt: true },
  })
  const eligible = candidateTickets
    .filter((ticket) => isSlaHalfElapsed(ticket))
    .sort((a, b) => (a.dueAt as Date).getTime() - (b.dueAt as Date).getTime())

  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true },
  })
  if (agents.length === 0) {
    return Response.json({ swept: 0, assignments: [], reason: "No agents available." })
  }

  const load = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: { assignedAgentId: { not: null }, status: { in: ["OPEN", "IN_PROGRESS"] } },
    _count: { _all: true },
  })

  const loadByAgent = new Map<string, number>(agents.map((agent) => [agent.id, 0]))
  for (const row of load) {
    if (row.assignedAgentId) loadByAgent.set(row.assignedAgentId, row._count._all)
  }

  const assignments: { ticketId: string; agentId: string; agentName: string }[] = []
  for (const ticket of eligible) {
    let best = agents[0]
    let bestLoad = loadByAgent.get(best.id) ?? 0
    for (const agent of agents.slice(1)) {
      const agentLoad = loadByAgent.get(agent.id) ?? 0
      if (agentLoad < bestLoad || (agentLoad === bestLoad && agent.id < best.id)) {
        best = agent
        bestLoad = agentLoad
      }
    }

    assignments.push({ ticketId: ticket.id, agentId: best.id, agentName: best.name })
    loadByAgent.set(best.id, bestLoad + 1)
  }

  if (assignments.length > 0) {
    await prisma.$transaction(
      assignments.map((assignment) =>
        prisma.ticket.update({
          where: { id: assignment.ticketId },
          data: { assignedAgentId: assignment.agentId },
        }),
      ),
    )
  }

  return Response.json({ swept: assignments.length, assignments })
}
