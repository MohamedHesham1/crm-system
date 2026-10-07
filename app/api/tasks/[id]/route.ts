import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"
import { NOT_DELETED } from "@/lib/ticket-access"
import { TASK_SELECT } from "@/lib/task-select"
import { updateTaskSchema } from "@/lib/validation/task"

function taskAccessWhere(user: { id: string; role: string }) {
  return user.role === "ADMIN" ? {} : { ownerId: user.id }
}

async function staffOwner(ownerId: string): Promise<{ id: string } | null> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true },
  })
  return owner && isRole(owner.role) && isStaff(owner.role) ? { id: owner.id } : null
}

async function validateLinks(ticketId: string | null, customerId: string | null) {
  let ticket: { id: string; customerId: string } | null = null
  if (ticketId) {
    ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, ...NOT_DELETED },
      select: { id: true, customerId: true },
    })
    if (!ticket) {
      return {
        ok: false as const,
        response: Response.json(
          { error: "Validation failed", fieldErrors: { ticketId: ["Choose an active ticket."] } },
          { status: 400 },
        ),
      }
    }
  }
  if (ticket && customerId !== ticket.customerId) {
    return {
      ok: false as const,
      response: Response.json(
        {
          error: "Validation failed",
          fieldErrors: { customerId: ["Customer must match the selected ticket."] },
        },
        { status: 400 },
      ),
    }
  }
  if (customerId && !(await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "Validation failed", fieldErrors: { customerId: ["Choose an existing customer."] } },
        { status: 400 },
      ),
    }
  }
  return { ok: true as const }
}

export const GET = withAuth(
  { role: "agent" },
  async (_request, ctx: { params: Promise<{ id: string }> }, user) => {
    const { id } = await ctx.params
    const task = await prisma.task.findFirst({
      where: { id, ...taskAccessWhere(user) },
      select: TASK_SELECT,
    })
    if (!task) return notFound("Task not found.")
    return Response.json({ task })
  },
)

export const PATCH = withAuth(
  { role: "agent" },
  async (request, ctx: { params: Promise<{ id: string }> }, user) => {
    const { id } = await ctx.params
    const current = await prisma.task.findFirst({
      where: { id, ...taskAccessWhere(user) },
      select: { id: true, ownerId: true, ticketId: true, customerId: true, completedAt: true },
    })
    if (!current) return notFound("Task not found.")

    const body = await readJson(request)
    if (!body.ok) return body.response
    const parsed = updateTaskSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)
    if (Object.keys(parsed.data).length === 0) {
      return Response.json({ error: "Provide at least one field to update." }, { status: 400 })
    }
    if (user.role !== "ADMIN" && parsed.data.ownerId !== undefined) {
      return Response.json({ error: "Only admins can assign tasks to other staff." }, { status: 403 })
    }

    const ownerId = parsed.data.ownerId ?? current.ownerId
    const owner = await staffOwner(ownerId)
    if (!owner) {
      return Response.json(
        { error: "Validation failed", fieldErrors: { ownerId: ["Choose a staff account."] } },
        { status: 400 },
      )
    }

    const ticketId =
      parsed.data.ticketId === undefined ? current.ticketId : parsed.data.ticketId
    let customerId =
      parsed.data.customerId === undefined ? current.customerId : parsed.data.customerId
    const shouldDeriveCustomer =
      parsed.data.ticketId !== undefined &&
      parsed.data.ticketId !== null &&
      parsed.data.ticketId !== current.ticketId &&
      parsed.data.customerId === undefined

    if (shouldDeriveCustomer && ticketId) {
      const linkedTicket = await prisma.ticket.findFirst({
        where: { id: ticketId, ...NOT_DELETED },
        select: { customerId: true },
      })
      if (!linkedTicket) {
        return Response.json(
          { error: "Validation failed", fieldErrors: { ticketId: ["Choose an active ticket."] } },
          { status: 400 },
        )
      }
      customerId = linkedTicket.customerId
    }
    const linksChanged =
      (parsed.data.ticketId !== undefined && parsed.data.ticketId !== current.ticketId) ||
      (parsed.data.customerId !== undefined && parsed.data.customerId !== current.customerId)
    if (linksChanged) {
      const links = await validateLinks(ticketId, customerId)
      if (!links.ok) return links.response
    }

    const completedAt =
      parsed.data.completed === undefined
        ? current.completedAt
        : parsed.data.completed
          ? current.completedAt ?? new Date()
          : null
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
        ...(parsed.data.description === undefined
          ? {}
          : { description: parsed.data.description || null }),
        ...(parsed.data.dueAt === undefined
          ? {}
          : { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null }),
        ...(parsed.data.ownerId === undefined ? {} : { ownerId: owner.id }),
        ...(parsed.data.ticketId === undefined ? {} : { ticketId }),
        ...(parsed.data.ticketId !== undefined || parsed.data.customerId !== undefined
          ? { customerId }
          : {}),
        ...(parsed.data.completed === undefined ? {} : { completedAt }),
      },
      select: TASK_SELECT,
    })
    return Response.json({ task })
  },
)

export const DELETE = withAuth(
  { role: "agent" },
  async (_request, ctx: { params: Promise<{ id: string }> }, user) => {
    const { id } = await ctx.params
    const task = await prisma.task.findFirst({
      where: { id, ...taskAccessWhere(user) },
      select: { id: true },
    })
    if (!task) return notFound("Task not found.")
    await prisma.task.delete({ where: { id } })
    return Response.json({ ok: true })
  },
)
