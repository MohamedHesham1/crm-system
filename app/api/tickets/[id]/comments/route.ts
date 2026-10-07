import { notify } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"
import { ticketScopeWhere, type Viewer } from "@/lib/ticket-access"
import { createCommentSchema } from "@/lib/validation/ticket"

const COMMENT_SELECT = {
  id: true,
  body: true,
  isInternal: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const

function commentSelect(includeMentions: boolean) {
  return {
    ...COMMENT_SELECT,
    ...(includeMentions
      ? {
          mentions: {
            orderBy: [{ createdAt: "asc" as const }, { userId: "asc" as const }],
            select: { user: { select: { id: true, name: true } } },
          },
        }
      : {}),
  }
}

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
  { role: "viewer", permission: "TICKETS_READ" },
  async (_request, ctx: RouteContext<"/api/tickets/[id]/comments">, viewer) => {
    const { id } = await ctx.params
    const scoped = await loadScopedTicket(viewer, id)
    if (!scoped.ok) return scoped.response

    const comments = await prisma.comment.findMany({
      where: {
        ticketId: id,
        ...(viewer.kind === "customer" ? { isInternal: false } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: commentSelect(viewer.kind === "staff"),
    })

    return Response.json({ comments })
  },
)

export const POST = withAuth(
  { role: "viewer", permission: "TICKETS_MANAGE" },
  async (request, ctx: RouteContext<"/api/tickets/[id]/comments">, viewer) => {
    const { id } = await ctx.params
    const scoped = await loadScopedTicket(viewer, id)
    if (!scoped.ok) return scoped.response

    const body = await readJson(request)
    if (!body.ok) return body.response

    const parsed = createCommentSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)
    if (
      viewer.kind !== "staff" &&
      (parsed.data.isInternal || parsed.data.mentionedUserIds.length > 0)
    ) {
      return Response.json(
        { error: "Customers cannot create internal notes or mention staff." },
        { status: 403 },
      )
    }

    const mentionedUserIds = [...new Set(parsed.data.mentionedUserIds)]
    if (mentionedUserIds.length > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: mentionedUserIds } },
        select: { id: true, role: true },
      })
      if (
        recipients.length !== mentionedUserIds.length ||
        recipients.some((recipient) => !isRole(recipient.role) || !isStaff(recipient.role))
      ) {
        return Response.json(
          {
            error: "Validation failed",
            fieldErrors: { mentionedUserIds: ["Choose existing staff accounts only."] },
          },
          { status: 400 },
        )
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          ticketId: id,
          authorId: viewer.id,
          body: parsed.data.body,
          isInternal: parsed.data.isInternal,
        },
      })

      for (const userId of mentionedUserIds) {
        await tx.commentMention.create({ data: { commentId: created.id, userId } })
      }

      await notify(
        tx,
        viewer.id,
        [
          ...(scoped.ticket.assignedAgentId === null ||
          mentionedUserIds.includes(scoped.ticket.assignedAgentId)
            ? []
            : [
                {
                  userId: scoped.ticket.assignedAgentId,
                  type: "TICKET_COMMENTED" as const,
                  message: `${viewer.name} commented on "${scoped.ticket.subject}".`,
                  relatedTicketId: id,
                },
              ]),
          ...mentionedUserIds.map((userId) => ({
            userId,
            type: "COMMENT_MENTIONED" as const,
            message: `${viewer.name} mentioned you on "${scoped.ticket.subject}".`,
            relatedTicketId: id,
          })),
        ],
      )

      return tx.comment.findUniqueOrThrow({
        where: { id: created.id },
        select: commentSelect(viewer.kind === "staff"),
      })
    })

    return Response.json({ comment }, { status: 201 })
  },
)
