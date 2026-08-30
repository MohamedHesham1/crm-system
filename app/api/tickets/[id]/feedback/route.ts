import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError } from "@/lib/api/http"
import { TERMINAL_STATUSES } from "@/lib/sla"
import { resolveViewer } from "@/lib/ticket-access"
import type { TicketStatus } from "@/lib/validation/ticket"
import { createFeedbackSchema } from "@/lib/validation/feedback"

const FEEDBACK_SELECT = { rating: true, comment: true, createdAt: true } as const

export async function POST(request: Request, ctx: RouteContext<"/api/tickets/[id]/feedback">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  // The inverse of `PATCH /api/tickets/[id]` (line 55): staff are refused here.
  // An `orphan` — a CUSTOMER login with no linked `Customer` row
  // (`lib/ticket-access.ts:12–20`) — is refused too, and is never resolved by
  // email. Ownership is `Customer.userId` or nothing.
  if (viewer.kind !== "customer") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  // Scoped by `customerId`, so a ticket belonging to someone else is a **404**,
  // not a 403 — the same choice `loadScopedTicket` makes at
  // `app/api/tickets/[id]/comments/route.ts:23`. A 403 confirms the id exists.
  const ticket = await prisma.ticket.findFirst({
    where: { id, customerId: viewer.customerId },
    select: { id: true, status: true, feedback: { select: { id: true } } },
  })
  if (!ticket) return notFound("Ticket not found.")

  if (!TERMINAL_STATUSES.includes(ticket.status as TicketStatus)) {
    return Response.json(
      { error: "You can rate this ticket once it has been resolved." },
      { status: 409 },
    )
  }

  if (ticket.feedback) {
    return Response.json({ error: "You have already rated this ticket." }, { status: 409 })
  }

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createFeedbackSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const comment = parsed.data.comment?.length ? parsed.data.comment : null

  try {
    const feedback = await prisma.feedback.create({
      data: { ticketId: id, rating: parsed.data.rating, comment },
      select: FEEDBACK_SELECT,
    })
    return Response.json({ feedback }, { status: 201 })
  } catch (error) {
    // The `@unique` on `ticketId` is the real guarantee; the check above is the
    // friendly path. Two submissions racing land here, and the loser gets the
    // same 409 it would have got a millisecond earlier.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "You have already rated this ticket." }, { status: 409 })
    }
    throw error
  }
}
