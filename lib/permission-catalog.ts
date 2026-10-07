export const PERMISSIONS = [
  "TICKETS_READ",
  "TICKETS_MANAGE",
  "CUSTOMERS_READ",
  "CUSTOMERS_MANAGE",
  "TASKS_MANAGE",
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  TICKETS_READ: "View tickets",
  TICKETS_MANAGE: "Manage tickets",
  CUSTOMERS_READ: "View customers",
  CUSTOMERS_MANAGE: "Manage customers",
  TASKS_MANAGE: "Manage tasks",
}

export type PermissionSetting = {
  permission: Permission
  label: string
  defaultGranted: boolean
  effectiveGranted: boolean
  overridden: boolean
}
