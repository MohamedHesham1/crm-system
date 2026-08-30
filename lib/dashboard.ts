import { request } from "@/lib/api/client"
import type { TicketListItem } from "@/lib/tickets"
import type { TicketStatus } from "@/lib/validation/ticket"

/**
 * The whole `GET /api/dashboard` payload. Composite rather than a bare array,
 * like `NotificationFeed` (`lib/notifications.ts:17–20`), so the page needs one
 * request for the counts and the list.
 *
 * `tickets` reuses `TicketListItem` — **do not** declare a second row type.
 * Its `dueAt` / `createdAt` are ISO **strings**, not `Date`s.
 */
export type DashboardSummary = {
  assigned: {
    total: number
    byStatus: Record<TicketStatus, number>
    breached: number
  }
  queue: {
    unassigned: number
    breached: number
  }
  tickets: TicketListItem[]
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/dashboard")
}
