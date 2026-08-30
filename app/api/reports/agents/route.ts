import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/api/http"
import { summariseAgents } from "@/lib/report-metrics"

export async function GET() {
  // Same two lines as `app/api/admin/audit/route.ts:8–9`. `middleware.ts`
  // excludes `/api/**` (matcher, line 37), so this is the only thing standing
  // between a plain AGENT and a per-agent leaderboard.
  const denied = await requireAdmin()
  if (denied) return denied

  const [rows, staff] = await Promise.all([
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
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
}
