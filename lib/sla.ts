import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"
import { DEFAULT_SLA_TARGETS } from "@/lib/validation/settings"

/** Statuses that stop the SLA clock. A resolved ticket can never breach. */
export const TERMINAL_STATUSES: readonly TicketStatus[] = ["RESOLVED", "CLOSED"]

/**
 * `dueAt` is the resolution deadline. Callers with access to settings pass
 * configured resolution hours; the defaults keep seed and legacy callers safe.
 */
export function defaultDueAt(
  priority: TicketPriority,
  from: Date = new Date(),
  resolutionHours = DEFAULT_SLA_TARGETS[priority].resolutionHours,
): Date {
  return new Date(from.getTime() + resolutionHours * 60 * 60 * 1000)
}

/**
 * The computed breach flag — `dueAt` in the past and the ticket still live.
 * **There is no stored column**; every read path calls this. Accepts ISO
 * strings as well as `Date`s so the same function works on a Prisma row and on
 * the JSON a client received.
 */
export function isSlaBreached(
  ticket: { dueAt: Date | string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!ticket.dueAt) return false
  if (TERMINAL_STATUSES.includes(ticket.status as TicketStatus)) return false
  return new Date(ticket.dueAt).getTime() < now.getTime()
}

/**
 * True when more than half the createdAt→dueAt window has elapsed. This is the
 * sweep's eligibility test. A ticket with no `dueAt` has no window and is
 * **never** eligible.
 */
export function isSlaHalfElapsed(
  ticket: { createdAt: Date | string; dueAt: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!ticket.dueAt) return false
  const start = new Date(ticket.createdAt).getTime()
  const end = new Date(ticket.dueAt).getTime()
  if (end <= start) return true
  return now.getTime() >= start + (end - start) / 2
}

/**
 * The **same** rule as `isSlaBreached`, projected into a Prisma `where`
 * fragment so a count can run in SQL instead of loading every row.
 *
 * `isSlaBreached` stays the only thing a read path calls on a row it already
 * has; this is only for aggregates. Both read `TERMINAL_STATUSES`, so there is
 * still exactly one list of statuses that stop the clock. A third spelling of
 * `["RESOLVED", "CLOSED"]` anywhere in the codebase is a bug.
 *
 * The spread is required, not stylistic: `TERMINAL_STATUSES` is `readonly` and
 * Prisma's `notIn` takes a mutable `string[]`.
 */
export function slaBreachedWhere(now: Date = new Date()) {
  return { dueAt: { lt: now }, status: { notIn: [...TERMINAL_STATUSES] } }
}

/** Tickets still on the clock — the complement of `TERMINAL_STATUSES`. */
export function liveStatusWhere() {
  return { status: { notIn: [...TERMINAL_STATUSES] } }
}
