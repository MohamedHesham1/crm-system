import { z } from "zod"

import { emailField } from "@/lib/validation/email"

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  email: emailField,
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required.")
    .max(40, "Phone must be 40 characters or fewer."),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .optional(),
  notes: z.string().max(10_000, "Notes must be 10,000 characters or fewer.").optional(),
})

/** PATCH accepts any subset. An empty object is rejected by the route, not here. */
export const updateCustomerSchema = createCustomerSchema.partial()

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
