import { z } from "zod"

import { ROLES } from "@/lib/roles"
import { emailField } from "@/lib/validation/email"

/** Only staff accounts can be created here. CUSTOMER is deliberately excluded. */
export const CREATABLE_ROLES = ROLES.filter((role) => role !== "CUSTOMER")

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  email: emailField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password must be 200 characters or fewer."),
  role: z.enum(["AGENT", "ADMIN"], { message: "Choose AGENT or ADMIN." }),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
