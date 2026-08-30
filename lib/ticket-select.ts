/**
 * The list-row projection shared by `GET /api/tickets` and `GET /api/dashboard`.
 * It is the server-side counterpart of `TicketListItem` in `lib/tickets.ts:20–31`
 * — every field here appears there, and `slaBreached` is added by the caller
 * via `isSlaBreached`, never selected (there is no column).
 *
 * `as const` is load-bearing: without it Prisma widens the literal `true`s and
 * loses the narrowed result type.
 */
export const TICKET_LIST_SELECT = {
  id: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  dueAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  assignedAgent: { select: { id: true, name: true } },
} as const
