import { z } from "zod"

import { PERMISSIONS } from "@/lib/permission-catalog"

export const permissionChangeSchema = z.object({
  permission: z.enum(PERMISSIONS),
  granted: z.boolean(),
})

export type PermissionChangeInput = z.infer<typeof permissionChangeSchema>
