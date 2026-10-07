import { z } from "zod"

import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/validation/ticket"

export const DEFAULT_TICKET_CATEGORY = {
  id: "default-ticket-category-billing",
  name: "Billing",
  normalizedName: "billing",
  active: true,
  sortOrder: 0,
} as const

export const DEFAULT_SLA_TARGETS: Record<
  TicketPriority,
  { priority: TicketPriority; responseHours: number; resolutionHours: number }
> = {
  HIGH: { priority: "HIGH", responseHours: 4, resolutionHours: 4 },
  MEDIUM: { priority: "MEDIUM", responseHours: 24, resolutionHours: 24 },
  LOW: { priority: "LOW", responseHours: 72, resolutionHours: 72 },
}

const categoryName = z
  .string()
  .trim()
  .min(1, "Category name is required.")
  .max(60, "Category name must be 60 characters or fewer.")

const hours = z
  .number()
  .int("Target must be a whole number of hours.")
  .min(1, "Target must be at least 1 hour.")
  .max(8_760, "Target cannot exceed 8,760 hours.")

export const createTicketCategorySchema = z.object({ name: categoryName })

const updateCategory = z
  .object({
    id: z.string().min(1),
    name: categoryName.optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => value.name !== undefined || value.active !== undefined || value.sortOrder !== undefined, {
    message: "Provide a category field to update.",
  })

const updateTargets = z
  .array(
    z.object({
      priority: z.enum(TICKET_PRIORITIES),
      responseHours: hours,
      resolutionHours: hours,
    }),
  )
  .min(1)
  .max(TICKET_PRIORITIES.length)
  .refine((targets) => new Set(targets.map((target) => target.priority)).size === targets.length, {
    message: "Each priority can appear only once.",
  })

export const updateTicketSettingsSchema = z.union([
  z.object({ category: updateCategory }),
  z.object({ slaTargets: updateTargets }),
])

export type TicketCategoryInput = z.infer<typeof createTicketCategorySchema>
export type UpdateTicketSettingsInput = z.infer<typeof updateTicketSettingsSchema>
export type SlaTargetSetting = (typeof DEFAULT_SLA_TARGETS)[TicketPriority]
