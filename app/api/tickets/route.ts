import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError } from "@/lib/api/http"
import { defaultDueAt, isSlaBreached } from "@/lib/sla"
import { resolveViewer, ticketScopeWhere } from "@/lib/ticket-access"
import {
  createPortalTicketSchema,
  createTicketSchema,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/validation/ticket"

const TICKET_SELECT = {
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

export async function GET(request: Request) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

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

  const tickets = await prisma.ticket.findMany({
    where: { ...ticketScopeWhere(viewer), ...filters },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    select: TICKET_SELECT,
  })

  return Response.json({
    tickets: tickets.map((ticket) => ({ ...ticket, slaBreached: isSlaBreached(ticket) })),
  })
}

export async function POST(request: Request) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

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

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      description,
      category,
      priority,
      status: "OPEN",
      customerId,
      assignedAgentId,
      dueAt,
    },
    select: TICKET_SELECT,
  })

  return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } }, { status: 201 })
}
