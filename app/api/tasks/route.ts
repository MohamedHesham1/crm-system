import { prisma } from "@/lib/prisma"
import { readJson, validationError, withAuth } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"
import { NOT_DELETED } from "@/lib/ticket-access"
import { TASK_SELECT } from "@/lib/task-select"
import { createTaskSchema } from "@/lib/validation/task"

const MAX_TASKS_PER_GROUP = 100

async function resolveTaskLinks(input: {
  ticketId?: string | null
  customerId?: string | null
  deriveCustomerFromTicket?: boolean
}): Promise<
  | { ok: true; ticketId: string | null; customerId: string | null }
  | { ok: false; response: Response }
> {
  let ticket: { id: string; customerId: string } | null = null
  if (input.ticketId) {
    ticket = await prisma.ticket.findFirst({
      where: { id: input.ticketId, ...NOT_DELETED },
      select: { id: true, customerId: true },
    })
    if (!ticket) {
      return {
        ok: false,
        response: Response.json(
          { error: "Validation failed", fieldErrors: { ticketId: ["Choose an active ticket."] } },
          { status: 400 },
        ),
      }
    }
  }

  const customerId =
    input.deriveCustomerFromTicket && ticket ? ticket.customerId : input.customerId ?? null
  if (ticket && customerId !== ticket.customerId) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Validation failed",
          fieldErrors: { customerId: ["Customer must match the selected ticket."] },
        },
        { status: 400 },
      ),
    }
  }

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    })
    if (!customer) {
      return {
        ok: false,
        response: Response.json(
          { error: "Validation failed", fieldErrors: { customerId: ["Choose an existing customer."] } },
          { status: 400 },
        ),
      }
    }
  }
  return { ok: true, ticketId: ticket?.id ?? null, customerId }
}

async function staffOwner(ownerId: string): Promise<{ id: string } | null> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true },
  })
  return owner && isRole(owner.role) && isStaff(owner.role) ? { id: owner.id } : null
}

export const GET = withAuth({ role: "agent", permission: "TASKS_MANAGE" }, async (request, _ctx, user) => {
  const query = new URL(request.url).searchParams
  const requestedOwner = query.get("ownerId")
  let ownerWhere: { ownerId?: string } = { ownerId: user.id }

  if (user.role === "ADMIN" && requestedOwner && requestedOwner !== "me" && requestedOwner !== "all") {
    if (!(await staffOwner(requestedOwner))) {
      return Response.json({ error: "Choose a staff account." }, { status: 400 })
    }
    ownerWhere = { ownerId: requestedOwner }
  } else if (user.role === "ADMIN" && requestedOwner === "all") {
    ownerWhere = {}
  } else if (requestedOwner && requestedOwner !== "me") {
    return Response.json({ error: "Agents can view only their own tasks." }, { status: 403 })
  }

  const now = new Date()
  const base = { ...ownerWhere }
  const [upcoming, overdue, completed] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...base,
        completedAt: null,
        OR: [{ dueAt: null }, { dueAt: { gt: now } }],
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: MAX_TASKS_PER_GROUP,
      select: TASK_SELECT,
    }),
    prisma.task.findMany({
      where: { ...base, completedAt: null, dueAt: { lte: now } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: MAX_TASKS_PER_GROUP,
      select: TASK_SELECT,
    }),
    prisma.task.findMany({
      where: { ...base, completedAt: { not: null } },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: MAX_TASKS_PER_GROUP,
      select: TASK_SELECT,
    }),
  ])

  return Response.json({ upcoming, overdue, completed })
})

export const POST = withAuth({ role: "agent", permission: "TASKS_MANAGE" }, async (request, _ctx, user) => {
  const body = await readJson(request)
  if (!body.ok) return body.response
  const parsed = createTaskSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)
  if (user.role !== "ADMIN" && parsed.data.ownerId !== undefined) {
    return Response.json({ error: "Only admins can assign tasks to other staff." }, { status: 403 })
  }

  const ownerId = parsed.data.ownerId ?? user.id
  const owner = await staffOwner(ownerId)
  if (!owner) {
    return Response.json(
      { error: "Validation failed", fieldErrors: { ownerId: ["Choose a staff account."] } },
      { status: 400 },
    )
  }

  const links = await resolveTaskLinks({
    ticketId: parsed.data.ticketId,
    customerId: parsed.data.customerId,
    deriveCustomerFromTicket: parsed.data.customerId === undefined,
  })
  if (!links.ok) return links.response

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      ownerId: owner.id,
      ticketId: links.ticketId,
      customerId: links.customerId,
    },
    select: TASK_SELECT,
  })
  return Response.json({ task }, { status: 201 })
})
