import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import type { RegisterInput } from "@/lib/validation/register"

export type RegisterFailure = "email-taken" | "customer-claimed"

export type RegisterResult =
  | { ok: true; userId: string; customerId: string; linked: boolean }
  | { ok: false; reason: RegisterFailure }

/** User-facing text for each failure. Shared by the route and the server action. */
export const REGISTER_ERRORS: Record<RegisterFailure, string> = {
  "email-taken": "An account with this email already exists. Sign in instead.",
  "customer-claimed": "This email is already linked to another account.",
}

/** Thrown inside the transaction so a conflict rolls the new `User` back. */
class RegistrationConflict extends Error {
  constructor(readonly reason: RegisterFailure) {
    super(reason)
    this.name = "RegistrationConflict"
  }
}

/**
 * Creates a CUSTOMER login and attaches it to a `Customer` profile — claiming
 * an existing unlinked one when the email matches, otherwise creating a new
 * one. Both writes happen in a single `$transaction`, so a half-registered
 * user (a `User` with no profile) is not a reachable state.
 *
 * KNOWN, ACCEPTED RISK: there is no email verification (out of scope for this
 * story — no email infrastructure exists). Anyone who knows an agent-created
 * customer's email address can claim that profile. Verification, or an
 * agent-controlled "allow portal signup" flag on `Customer`, is the fix.
 *
 * `email` must already be normalised by `registerSchema` — every comparison
 * below is an exact match. SQLite has no `mode: "insensitive"` (the generated
 * client has no `QueryMode`), so case-insensitivity comes from the schema
 * lowercasing on the way in, and from nothing else.
 */
export async function registerCustomer(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, password } = input

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) return { ok: false, reason: "email-taken" }

  const passwordHash = await hashPassword(password)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "CUSTOMER" },
        select: { id: true },
      })

      const existingCustomer = await tx.customer.findUnique({
        where: { email },
        select: { id: true, userId: true },
      })

      if (existingCustomer?.userId) throw new RegistrationConflict("customer-claimed")

      if (existingCustomer) {
        await tx.customer.update({
          where: { id: existingCustomer.id },
          data: { userId: user.id },
        })
        return { ok: true as const, userId: user.id, customerId: existingCustomer.id, linked: true }
      }

      const customer = await tx.customer.create({
        // `phone` is required by the schema but not collected at registration.
        // Empty string, matching how `notes` defaults. The agent fills it in later.
        data: { name, email, phone: "", userId: user.id },
        select: { id: true },
      })
      return { ok: true as const, userId: user.id, customerId: customer.id, linked: false }
    })
  } catch (error) {
    if (error instanceof RegistrationConflict) return { ok: false, reason: error.reason }
    // Two concurrent registrations for the same email: the `findUnique` above
    // passed for both, and the loser trips `User_email_key`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "email-taken" }
    }
    throw error
  }
}
