import { notify } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { ticketScopeWhere, type Viewer } from "@/lib/ticket-access"
import { createCommentSchema } from "@/lib/validation/ticket"

const COMMENT_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const

/** Both verbs re-check ownership on every call — do not trust that the client only polls tickets it can see. */
async function loadScopedTicket(viewer: Viewer, id: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketScopeWhere(viewer) },
    select: { id: true, subject: true, assignedAgentId: true },
  })
  if (!ticket) return { ok: false as const, response: notFound("Ticket not found.") }

  return { ok: true as const, ticket }
}

export const GET = withAuth(
  { role: "viewer" },
  async (_request, ctx: RouteContext<"/api/tickets/[id]/comments">, viewer) => {
    const { id } = await ctx.params
    const scoped = await loadScopedTicket(viewer, id)
    if (!scoped.ok) return scoped.response

    const comments = await prisma.comment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      select: COMMENT_SELECT,
    })

    return Response.json({ comments })
  },
)

export const POST = withAuth(
  { role: "viewer" },
  async (request, ctx: RouteContext<"/api/tickets/[id]/comments">, viewer) => {
    const { id } = await ctx.params
    const scoped = await loadScopedTicket(viewer, id)
    if (!scoped.ok) return scoped.response

    const body = await readJson(request)
    if (!body.ok) return body.response

    const parsed = createCommentSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { ticketId: id, authorId: viewer.id, body: parsed.data.body },
        select: COMMENT_SELECT,
      })

      await notify(
        tx,
        viewer.id,
        scoped.ticket.assignedAgentId === null
          ? []
          : [
              {
                userId: scoped.ticket.assignedAgentId,
                type: "TICKET_COMMENTED",
                message: `${viewer.name} commented on "${scoped.ticket.subject}".`,
                relatedTicketId: id,
              },
            ],
      )

      return created
    })

    return Response.json({ comment }, { status: 201 })
  },
)
