import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getTicketSettings } from "@/lib/settings"
import { readJson, validationError, withAuth } from "@/lib/api/http"
import {
  createTicketCategorySchema,
  DEFAULT_TICKET_CATEGORY,
  updateTicketSettingsSchema,
} from "@/lib/validation/settings"

export const GET = withAuth({ role: "admin" }, async () => {
  return Response.json(await getTicketSettings())
})

export const POST = withAuth({ role: "admin" }, async (request, _ctx, user) => {
  const body = await readJson(request)
  if (!body.ok) return body.response
  const parsed = createTicketCategorySchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const name = parsed.data.name
  try {
    const category = await prisma.$transaction(async (tx) => {
      const categoryCount = await tx.ticketCategory.count()
      if (categoryCount === 0) {
        await tx.ticketCategory.upsert({
          where: { id: DEFAULT_TICKET_CATEGORY.id },
          update: {},
          create: { ...DEFAULT_TICKET_CATEGORY },
        })
      }
      const maxOrder = await tx.ticketCategory.aggregate({ _max: { sortOrder: true } })
      const created = await tx.ticketCategory.create({
        data: {
          name,
          normalizedName: name.toLowerCase(),
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      })
      await tx.auditLog.create({
        data: {
          entityType: "TicketCategory",
          entityId: created.id,
          action: "SETTINGS_CHANGED",
          actorId: user.id,
          detail: `${user.name} added ticket category "${created.name}".`,
        },
      })
      return created
    })
    return Response.json({ category }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { name: ["A category with this name already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
})

export const PATCH = withAuth({ role: "admin" }, async (request, _ctx, user) => {
  const body = await readJson(request)
  if (!body.ok) return body.response
  const parsed = updateTicketSettingsSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  if ("slaTargets" in parsed.data) {
    const { slaTargets } = parsed.data
    const changedTargets = await prisma.$transaction(async (tx) => {
      const changed = []
      for (const target of slaTargets) {
        const before = await tx.slaTarget.findUnique({ where: { priority: target.priority } })
        const saved = await tx.slaTarget.upsert({
          where: { priority: target.priority },
          update: {
            responseHours: target.responseHours,
            resolutionHours: target.resolutionHours,
          },
          create: target,
        })
        if (
          !before ||
          before.responseHours !== saved.responseHours ||
          before.resolutionHours !== saved.resolutionHours
        ) {
          await tx.auditLog.create({
            data: {
              entityType: "SlaTarget",
              entityId: target.priority,
              action: "SETTINGS_CHANGED",
              actorId: user.id,
              detail: `${user.name} set ${target.priority} response target to ${target.responseHours}h and resolution target to ${target.resolutionHours}h.`,
            },
          })
        }
        changed.push(saved)
      }
      return changed
    })
    return Response.json({ slaTargets: changedTargets })
  }

  const { category: changes } = parsed.data
  try {
    const result = await prisma.$transaction(async (tx) => {
      let before = await tx.ticketCategory.findUnique({ where: { id: changes.id } })
      if (!before && changes.id === DEFAULT_TICKET_CATEGORY.id) {
        before = await tx.ticketCategory.upsert({
          where: { id: DEFAULT_TICKET_CATEGORY.id },
          update: {},
          create: { ...DEFAULT_TICKET_CATEGORY },
        })
      }
      if (!before) return { notFound: true as const }

      const willBeActive = changes.active ?? before.active
      if (before.active && !willBeActive) {
        const activeCount = await tx.ticketCategory.count({ where: { active: true } })
        if (activeCount <= 1) return { lastActive: true as const }
      }

      const name = changes.name ?? before.name
      const saved = await tx.ticketCategory.update({
        where: { id: changes.id },
        data: {
          ...(changes.name === undefined ? {} : { name, normalizedName: name.toLowerCase() }),
          ...(changes.active === undefined ? {} : { active: changes.active }),
          ...(changes.sortOrder === undefined ? {} : { sortOrder: changes.sortOrder }),
        },
      })
      const changed =
        saved.name !== before.name ||
        saved.active !== before.active ||
        saved.sortOrder !== before.sortOrder
      if (changed) {
        await tx.auditLog.create({
          data: {
            entityType: "TicketCategory",
            entityId: saved.id,
            action: "SETTINGS_CHANGED",
            actorId: user.id,
            detail: `${user.name} updated ticket category "${before.name}" to "${saved.name}" (${saved.active ? "active" : "inactive"}, order ${saved.sortOrder}).`,
          },
        })
      }
      return { category: saved }
    })
    if ("notFound" in result) return Response.json({ error: "Ticket category not found." }, { status: 404 })
    if ("lastActive" in result) {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { active: ["At least one ticket category must remain active."] },
        },
        { status: 400 },
      )
    }
    return Response.json({ category: result.category })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { name: ["A category with this name already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
})
