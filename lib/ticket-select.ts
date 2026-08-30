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

/**
 * The detail projection shared by `GET`/`PATCH /api/tickets/[id]` and
 * `POST /api/tickets/[id]/reopen`. Lifted out of those two route files, where
 * it lived twice, byte-identical.
 *
 * `feedback` is a nullable to-one relation, so it selects to
 * `{ rating, comment, createdAt } | null` with no extra query.
 */
export const TICKET_DETAIL_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  dueAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, email: true, company: true } },
  assignedAgent: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  },
  feedback: { select: { rating: true, comment: true, createdAt: true } },
} as const
