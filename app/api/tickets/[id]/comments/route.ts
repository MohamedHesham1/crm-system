import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError } from "@/lib/api/http"
import { resolveViewer, ticketScopeWhere } from "@/lib/ticket-access"
import { createCommentSchema } from "@/lib/validation/ticket"

const COMMENT_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const

/** Both verbs re-check ownership on every call — do not trust that the client only polls tickets it can see. */
async function loadScopedTicket(id: string) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return { ok: false as const, response: resolved.response }

  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketScopeWhere(resolved.viewer) },
    select: { id: true },
  })
  if (!ticket) return { ok: false as const, response: notFound("Ticket not found.") }

  return { ok: true as const, viewer: resolved.viewer }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/tickets/[id]/comments">) {
  const { id } = await ctx.params
  const scoped = await loadScopedTicket(id)
  if (!scoped.ok) return scoped.response

  const comments = await prisma.comment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    select: COMMENT_SELECT,
  })

  return Response.json({ comments })
}

export async function POST(request: Request, ctx: RouteContext<"/api/tickets/[id]/comments">) {
  const { id } = await ctx.params
  const scoped = await loadScopedTicket(id)
  if (!scoped.ok) return scoped.response

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createCommentSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const comment = await prisma.comment.create({
    data: { ticketId: id, authorId: scoped.viewer.id, body: parsed.data.body },
    select: COMMENT_SELECT,
  })

  return Response.json({ comment }, { status: 201 })
}
