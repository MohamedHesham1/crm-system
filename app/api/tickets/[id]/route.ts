import { Prisma } from "@prisma/client"

import { assignmentNotifications, describeTicketChanges, logActivity, notify } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"
import { isSlaBreached, TERMINAL_STATUSES } from "@/lib/sla"
import { TICKET_DETAIL_SELECT } from "@/lib/ticket-select"
import { authorizeAssignmentChange, NOT_DELETED, ticketScopeWhere } from "@/lib/ticket-access"
import { updateTicketSchema, type TicketPriority, type TicketStatus } from "@/lib/validation/ticket"

export const GET = withAuth(
  { role: "viewer" },
  async (_request, ctx: RouteContext<"/api/tickets/[id]">, viewer) => {
    const { id } = await ctx.params

    const ticket = await prisma.ticket.findFirst({
      where: { id, ...ticketScopeWhere(viewer) },
      select: TICKET_DETAIL_SELECT,
    })
    if (!ticket) return notFound("Ticket not found.")

    return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
  },
)

export const PATCH = withAuth(
  { role: "viewer" },
  async (request, ctx: RouteContext<"/api/tickets/[id]">, viewer) => {
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

    const current = await prisma.ticket.findFirst({
      where: { id, ...NOT_DELETED },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        assignedAgentId: true,
        assignedAgent: { select: { name: true } },
      },
    })
    if (!current) return notFound("Ticket not found.")

    let nextAgentName: string | null = null

    if ("assignedAgentId" in parsed.data) {
      const next = parsed.data.assignedAgentId ?? null
      const decision = authorizeAssignmentChange(current.assignedAgentId, next, viewer)
      if (!decision.allowed) return Response.json({ error: decision.reason }, { status: 403 })

      if (next !== null) {
        const target = await prisma.user.findUnique({
          where: { id: next },
          select: { name: true, role: true },
        })
        if (!target || !isRole(target.role) || !isStaff(target.role)) {
          return Response.json(
            { error: "Validation failed", fieldErrors: { assignedAgentId: ["Choose a staff account."] } },
            { status: 400 },
          )
        }
        nextAgentName = target.name
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
    const wasTerminal = TERMINAL_STATUSES.includes(current.status as TicketStatus)
    const willBeTerminal =
      parsed.data.status === undefined
        ? wasTerminal
        : TERMINAL_STATUSES.includes(parsed.data.status)

    const data = {
      ...rest,
      ...(dueAt === undefined ? {} : { dueAt: dueAt === null ? null : new Date(dueAt) }),
      // Only the *transition* writes. RESOLVED -> CLOSED leaves the original
      // moment alone (both are terminal), and a PATCH that touches only
      // `priority` never rewrites it. A terminal -> non-terminal move cannot
      // happen here for a CLOSED ticket (409 above) but can for a RESOLVED
      // one, and that clears the stamp.
      ...(wasTerminal === willBeTerminal ? {} : { resolvedAt: willBeTerminal ? new Date() : null }),
    }

    const changes = describeTicketChanges(
      {
        status: current.status as TicketStatus,
        priority: current.priority as TicketPriority,
        assignedAgentId: current.assignedAgentId,
      },
      parsed.data,
      { id: viewer.id, name: viewer.name },
      { previous: current.assignedAgent?.name ?? null, next: nextAgentName },
    )

    const notifications =
      "assignedAgentId" in parsed.data
        ? assignmentNotifications(
            { id: current.id, subject: current.subject },
            current.assignedAgentId,
            parsed.data.assignedAgentId ?? null,
            viewer.name,
          )
        : []

    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.update({ where: { id }, data, select: TICKET_DETAIL_SELECT })

        await logActivity(
          tx,
          changes.map((change) => ({
            entityType: "Ticket" as const,
            entityId: id,
            action: change.action,
            actorId: viewer.id,
            detail: change.detail,
          })),
        )
        await notify(tx, viewer.id, notifications)

        return updated
      })

      return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return notFound("Ticket not found.")
      }
      throw error
    }
  },
)

export const DELETE = withAuth(
  { role: "admin" },
  async (_request, ctx: RouteContext<"/api/tickets/[id]">, admin) => {
    const { id } = await ctx.params

    const existing = await prisma.ticket.findFirst({
      where: { id, ...NOT_DELETED },
      select: { subject: true },
    })
    if (!existing) return notFound("Ticket not found.")

    try {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({ where: { id }, data: { deletedAt: new Date() } })
        await logActivity(tx, [
          {
            entityType: "Ticket",
            entityId: id,
            action: "TICKET_DELETED",
            actorId: admin.id,
            detail: `Ticket "${existing.subject}" deleted by ${admin.name}.`,
          },
        ])
      })
      return Response.json({ ok: true })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return notFound("Ticket not found.")
      }
      throw error
    }
  },
)
