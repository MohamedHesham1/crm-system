import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { parsePagination } from "@/lib/api/pagination"
import { defaultDueAt, isSlaBreached } from "@/lib/sla"
import { TICKET_LIST_SELECT } from "@/lib/ticket-select"
import { ticketScopeWhere } from "@/lib/ticket-access"
import {
  createPortalTicketSchema,
  createTicketSchema,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/validation/ticket"

export const GET = withAuth({ role: "viewer" }, async (request, _ctx, viewer) => {
  const searchParams = new URL(request.url).searchParams
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const assigned = searchParams.get("assigned")

  const filters: Record<string, unknown> = {}
  if (status && (TICKET_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as TicketStatus
  }
  if (priority && (TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    filters.priority = priority as TicketPriority
  }
  if (assigned === "me") filters.assignedAgentId = viewer.id
  if (assigned === "none") filters.assignedAgentId = null

  const { page, pageSize, skip, take } = parsePagination(request)
  const where = { ...ticketScopeWhere(viewer), ...filters }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: TICKET_LIST_SELECT,
    }),
    prisma.ticket.count({ where }),
  ])

  return Response.json({
    tickets: tickets.map((ticket) => ({ ...ticket, slaBreached: isSlaBreached(ticket) })),
    total,
    page,
    pageSize,
  })
})

export const POST = withAuth({ role: "viewer" }, async (request, _ctx, viewer) => {
  if (viewer.kind === "orphan") {
    return Response.json(
      { error: "No customer profile is linked to this account." },
      { status: 403 },
    )
  }

  const body = await readJson(request)
  if (!body.ok) return body.response

  let customerId: string
  let assignedAgentId: string | null
  let subject: string
  let description: string
  let category: string
  let priority: TicketPriority
  let dueAt: Date

  if (viewer.kind === "staff") {
    const parsed = createTicketSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true },
    })
    if (!customer) return notFound("Customer not found.")

    customerId = parsed.data.customerId
    assignedAgentId = parsed.data.assignToMe ? viewer.id : null
    subject = parsed.data.subject
    description = parsed.data.description
    category = parsed.data.category
    priority = parsed.data.priority
    dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : defaultDueAt(priority)
  } else {
    const parsed = createPortalTicketSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    customerId = viewer.customerId
    assignedAgentId = null
    subject = parsed.data.subject
    description = parsed.data.description
    category = parsed.data.category
    priority = parsed.data.priority
    dueAt = defaultDueAt(priority)
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: { subject, description, category, priority, status: "OPEN", customerId, assignedAgentId, dueAt },
      select: TICKET_LIST_SELECT,
    })

    await logActivity(tx, [
      {
        entityType: "Ticket",
        entityId: created.id,
        action: "TICKET_CREATED",
        actorId: viewer.id,
        detail: `Ticket created by ${viewer.name}${assignedAgentId === viewer.id ? " and claimed" : ""}.`,
      },
    ])

    return created
  })

  return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } }, { status: 201 })
})
