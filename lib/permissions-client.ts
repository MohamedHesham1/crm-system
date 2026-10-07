import { request } from "@/lib/api/client"
import type { Permission, PermissionSetting } from "@/lib/permission-catalog"

export const userPermissionKeys = {
  all: ["user-permissions"] as const,
  detail: (id: string) => [...userPermissionKeys.all, id] as const,
}

export async function fetchUserPermissions(id: string): Promise<PermissionSetting[]> {
  const { permissions } = await request<{ permissions: PermissionSetting[] }>(
    `/api/admin/users/${id}/permissions`,
  )
  return permissions
}

export async function setUserPermission(
  id: string,
  input: { permission: Permission; granted: boolean },
): Promise<PermissionSetting[]> {
  const { permissions } = await request<{ permissions: PermissionSetting[] }>(
    `/api/admin/users/${id}/permissions`,
    { method: "PATCH", body: JSON.stringify(input) },
  )
  return permissions
}

export async function resetUserPermission(
  id: string,
  permission: Permission,
): Promise<PermissionSetting[]> {
  const { permissions } = await request<{ permissions: PermissionSetting[] }>(
    `/api/admin/users/${id}/permissions?permission=${encodeURIComponent(permission)}`,
    { method: "DELETE" },
  )
  return permissions
}
