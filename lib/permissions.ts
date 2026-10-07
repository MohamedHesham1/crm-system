import { prisma } from "@/lib/prisma"
import { isStaff, type Role } from "@/lib/roles"
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type PermissionSetting,
} from "@/lib/permission-catalog"

export { PERMISSIONS, PERMISSION_LABELS }
export type { Permission, PermissionSetting }

const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  AGENT: PERMISSIONS,
  CUSTOMER: [],
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value)
}

export function defaultPermission(role: Role, permission: Permission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission)
}

export async function hasPermission(
  user: { id: string; role: Role },
  permission: unknown,
): Promise<boolean> {
  if (!isPermission(permission) || !isStaff(user.role)) return false
  if (user.role === "ADMIN") return true

  const override = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId: user.id, permission } },
    select: { granted: true },
  })
  return override?.granted ?? defaultPermission(user.role, permission)
}

export async function getPermissionSettings(
  user: { id: string; role: Role },
): Promise<PermissionSetting[]> {
  const overrides = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true, granted: true },
  })
  const byPermission = new Map(
    overrides.filter((entry) => isPermission(entry.permission)).map((entry) => [entry.permission, entry.granted]),
  )

  return PERMISSIONS.map((permission) => {
    const defaultGranted = defaultPermission(user.role, permission)
    const override = byPermission.get(permission)
    return {
      permission,
      label: PERMISSION_LABELS[permission],
      defaultGranted,
      effectiveGranted: override ?? defaultGranted,
      overridden: override !== undefined,
    }
  })
}
