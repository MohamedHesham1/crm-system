import { z } from "zod"

import { ROLES } from "@/lib/roles"

/**
 * Same normalisation as `lib/validation/customer.ts`: trim and lowercase
 * *before* the format check, because `User.email` is `@unique` and SQLite
 * compares text case-sensitively.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

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
