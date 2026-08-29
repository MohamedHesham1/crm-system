import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

/** Statuses that stop the SLA clock. A resolved ticket can never breach. */
const TERMINAL_STATUSES: readonly TicketStatus[] = ["RESOLVED", "CLOSED"]

/**
 * Hours from creation to `dueAt`, per priority. Applied only when the reporter
 * did not supply an explicit `dueAt`.
 *
 * These numbers are a product decision made in this story, not something the
 * acceptance criteria fixed: the criteria require `dueAt` to be nullable and
 * require the sweep to act on "SLA window more than half elapsed", which is
 * unreachable if `dueAt` is always null. Change the table freely; do not move
 * it into the database.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  HIGH: 4,
  MEDIUM: 24,
  LOW: 72,
}

export function defaultDueAt(priority: TicketPriority, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000)
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
