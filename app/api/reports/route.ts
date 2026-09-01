import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/http"
import { isStaff } from "@/lib/roles"
import { TERMINAL_STATUSES } from "@/lib/sla"
import { NOT_DELETED } from "@/lib/ticket-access"
import { summariseSla } from "@/lib/report-metrics"
import { RATING_VALUES } from "@/lib/validation/feedback"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validation/ticket"

/**
 * Zero-fills a `groupBy` result against an allowed tuple, mirroring the inline
 * loop at `app/api/dashboard/route.ts:51–61` including its `includes` guard: a
 * row whose key falls outside the tuple lands in no bucket rather than
 * inventing one.
 */
function zeroFill<K extends string>(
  keys: readonly K[],
  rows: Record<string, unknown>[],
  field: string,
): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>
  for (const row of rows) {
    const value = row[field] as K
    if ((keys as readonly string[]).includes(value)) {
      result[value] = (row._count as { _all: number })._all
    }
  }
  return result
}

export const GET = withAuth({ role: "user" }, async (_request, _ctx, user) => {
  // Same reasoning as `app/api/dashboard/route.ts:20–25`: `agent` would do
  // here (no caller identity is needed), but keeping both staff read
  // endpoints on one idiom is worth more than saving a line. A CUSTOMER gets a
  // 403 — there is no customer-shaped reading of internal performance.
  if (!isStaff(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const [byStatusRows, byPriorityRows, resolvedRows, csat, ratingRows] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: NOT_DELETED, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], where: NOT_DELETED, _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null }, ...NOT_DELETED },
      select: { createdAt: true, resolvedAt: true, dueAt: true, assignedAgentId: true },
    }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.feedback.groupBy({ by: ["rating"], _count: { _all: true } }),
  ])

  const byStatus = zeroFill(TICKET_STATUSES, byStatusRows, "status")
  const byPriority = zeroFill(TICKET_PRIORITIES, byPriorityRows, "priority")

  // `resolvedAt: { not: null }` narrows the value in SQL but not in the type —
  // Prisma still types the column `Date | null`. This assertion is the one place
  // that gap is bridged; `summariseSla` then takes a non-null `resolvedAt` and
  // stays honest about what it is averaging.
  const sla = summariseSla(resolvedRows.map((row) => ({ ...row, resolvedAt: row.resolvedAt! })))

  const distribution = Object.fromEntries(
    RATING_VALUES.map((rating) => [rating, 0]),
  ) as Record<number, number>
  for (const row of ratingRows) distribution[row.rating] = row._count._all

  return Response.json({
    tickets: {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      byPriority,
    },
    sla,
    csat: {
      // `_avg` is `null` on an empty table, and that is the correct answer —
      // do not coalesce it to 0, which reads as "everyone hated us".
      average: csat._avg.rating,
      count: csat._count._all,
      distribution,
    },
    terminalStatuses: TERMINAL_STATUSES,
  })
})
