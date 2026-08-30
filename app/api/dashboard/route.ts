import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api/http"
import { isStaff } from "@/lib/roles"
import { isSlaBreached, liveStatusWhere, slaBreachedWhere } from "@/lib/sla"
import { TICKET_LIST_SELECT } from "@/lib/ticket-select"
import { TICKET_STATUSES, type TicketStatus } from "@/lib/validation/ticket"

/**
 * How many of the agent's own tickets the dashboard lists. The counts above the
 * list are exact and unbounded; only the rendered rows are capped. Same idiom as
 * `NOTIFICATION_PAGE_SIZE` (`app/api/notifications/route.ts:5`).
 */
const DASHBOARD_TICKET_LIMIT = 10

export async function GET() {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response
  const { user } = resolved

  // `requireUser()` rather than `requireAgent()`: this endpoint needs the
  // caller's **id**, and `requireAgent()` returns only a Response-or-null. The
  // role check is therefore explicit. A CUSTOMER gets a `403` here — unlike
  // `/api/notifications`, which returns an empty `200`, because there is no
  // customer-shaped reading of "the unassigned agent queue".
  if (!isStaff(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  // One `now` for all five queries. Computing it per-query lets a slow request
  // count a ticket as breached in one number and not in the next.
  const now = new Date()
  const mine = { assignedAgentId: user.id }
  const queue = { assignedAgentId: null }

  const [byStatusRows, assignedBreached, queueUnassigned, queueBreached, tickets] =
    await Promise.all([
      prisma.ticket.groupBy({
        by: ["status"],
        where: mine,
        _count: { _all: true },
      }),
      prisma.ticket.count({ where: { ...mine, ...slaBreachedWhere(now) } }),
      prisma.ticket.count({ where: { ...queue, ...liveStatusWhere() } }),
      prisma.ticket.count({ where: { ...queue, ...slaBreachedWhere(now) } }),
      prisma.ticket.findMany({
        where: { ...mine, ...liveStatusWhere() },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: DASHBOARD_TICKET_LIMIT,
        select: TICKET_LIST_SELECT,
      }),
    ])

  // Zero-fill. `groupBy` returns a row only for statuses that actually occur;
  // the UI renders one tile per status and must show `0`, not a gap.
  const byStatus = Object.fromEntries(
    TICKET_STATUSES.map((status) => [status, 0]),
  ) as Record<TicketStatus, number>

  for (const row of byStatusRows) {
    if ((TICKET_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as TicketStatus] = row._count._all
    }
  }

  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

  return Response.json({
    assigned: { total, byStatus, breached: assignedBreached },
    queue: { unassigned: queueUnassigned, breached: queueBreached },
    tickets: tickets.map((ticket) => ({ ...ticket, slaBreached: isSlaBreached(ticket, now) })),
  })
}
