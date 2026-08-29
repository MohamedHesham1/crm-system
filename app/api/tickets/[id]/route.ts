import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, requireAdmin, validationError } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"
import { isSlaBreached } from "@/lib/sla"
import { authorizeAssignmentChange, resolveViewer, ticketScopeWhere } from "@/lib/ticket-access"
import { updateTicketSchema } from "@/lib/validation/ticket"

const TICKET_DETAIL_SELECT = {
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
} as const

export async function GET(_request: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  const { id } = await ctx.params

  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketScopeWhere(viewer) },
    select: TICKET_DETAIL_SELECT,
  })
  if (!ticket) return notFound("Ticket not found.")

  return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  if (viewer.kind !== "staff") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = updateTicketSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  if (Object.keys(parsed.data).length === 0) {
    return Response.json({ error: "Provide at least one field to update." }, { status: 400 })
  }

  const current = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, status: true, assignedAgentId: true },
  })
  if (!current) return notFound("Ticket not found.")

  if ("assignedAgentId" in parsed.data) {
    const next = parsed.data.assignedAgentId ?? null
    const decision = authorizeAssignmentChange(current.assignedAgentId, next, viewer)
    if (!decision.allowed) return Response.json({ error: decision.reason }, { status: 403 })

    if (next !== null) {
      const target = await prisma.user.findUnique({ where: { id: next }, select: { role: true } })
      if (!target || !isRole(target.role) || !isStaff(target.role)) {
        return Response.json(
          { error: "Validation failed", fieldErrors: { assignedAgentId: ["Choose a staff account."] } },
          { status: 400 },
        )
      }
    }
  }

  if (
    current.status === "CLOSED" &&
    parsed.data.status !== undefined &&
    parsed.data.status !== "CLOSED"
  ) {
    return Response.json(
      { error: "This ticket is closed. Use the reopen action to move it back to OPEN." },
      { status: 409 },
    )
  }

  const { dueAt, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(dueAt === undefined ? {} : { dueAt: dueAt === null ? null : new Date(dueAt) }),
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      select: TICKET_DETAIL_SELECT,
    })
    return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound("Ticket not found.")
    }
    throw error
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await ctx.params

  try {
    await prisma.ticket.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound("Ticket not found.")
    }
    throw error
  }
}
