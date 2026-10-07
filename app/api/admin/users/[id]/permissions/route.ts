import { prisma } from "@/lib/prisma"
import { getPermissionSettings, isPermission, PERMISSION_LABELS } from "@/lib/permissions"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { logActivity } from "@/lib/activity"
import { permissionChangeSchema } from "@/lib/validation/permissions"

async function loadAgent(id: string, actorId: string) {
  if (id === actorId) {
    return { ok: false as const, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  })
  if (!user) return { ok: false as const, response: notFound("User not found.") }
  if (user.role !== "AGENT") {
    return { ok: false as const, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, user }
}

export const GET = withAuth(
  { role: "admin" },
  async (_request, ctx: RouteContext<"/api/admin/users/[id]/permissions">, admin) => {
    const { id } = await ctx.params
    const target = await loadAgent(id, admin.id)
    if (!target.ok) return target.response

    const permissions = await getPermissionSettings({ id, role: "AGENT" })
    return Response.json({ permissions })
  },
)

export const PATCH = withAuth(
  { role: "admin" },
  async (request, ctx: RouteContext<"/api/admin/users/[id]/permissions">, admin) => {
    const { id } = await ctx.params
    const target = await loadAgent(id, admin.id)
    if (!target.ok) return target.response

    const body = await readJson(request)
    if (!body.ok) return body.response
    const parsed = permissionChangeSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const { permission, granted } = parsed.data
    await prisma.$transaction(async (tx) => {
      const current = await tx.userPermission.findUnique({
        where: { userId_permission: { userId: id, permission } },
        select: { granted: true },
      })
      if (current?.granted === granted) return

      await tx.userPermission.upsert({
        where: { userId_permission: { userId: id, permission } },
        create: { userId: id, permission, granted, actorId: admin.id },
        update: { granted, actorId: admin.id },
      })
      await logActivity(tx, [
        {
          entityType: "User",
          entityId: id,
          action: "PERMISSION_CHANGED",
          actorId: admin.id,
          detail: `${PERMISSION_LABELS[permission]} ${granted ? "granted to" : "revoked from"} ${target.user.name} by ${admin.name}.`,
        },
      ])
    })

    return Response.json({
      permissions: await getPermissionSettings({ id, role: "AGENT" }),
    })
  },
)

export const DELETE = withAuth(
  { role: "admin" },
  async (request, ctx: RouteContext<"/api/admin/users/[id]/permissions">, admin) => {
    const { id } = await ctx.params
    const target = await loadAgent(id, admin.id)
    if (!target.ok) return target.response

    const permission = new URL(request.url).searchParams.get("permission")
    if (!isPermission(permission)) {
      return Response.json(
        { error: "Validation failed", fieldErrors: { permission: ["Choose a valid permission."] } },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.userPermission.findUnique({
        where: { userId_permission: { userId: id, permission } },
        select: { id: true },
      })
      if (!current) return

      await tx.userPermission.delete({ where: { id: current.id } })
      await logActivity(tx, [
        {
          entityType: "User",
          entityId: id,
          action: "PERMISSION_CHANGED",
          actorId: admin.id,
          detail: `${PERMISSION_LABELS[permission]} reset to its role default for ${target.user.name} by ${admin.name}.`,
        },
      ])
    })

    return Response.json({
      permissions: await getPermissionSettings({ id, role: "AGENT" }),
    })
  },
)
