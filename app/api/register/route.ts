import { readJson, validationError, withAuth } from "@/lib/api/http"
import { RATE_LIMITS } from "@/lib/rate-limit"
import { REGISTER_ERRORS, registerCustomer } from "@/lib/registration"
import { registerSchema } from "@/lib/validation/register"

/**
 * **Public on purpose**, and now says so: `role: "public"` is a declaration the
 * type system requires, not an omission. The per-IP throttle runs inside
 * `withAuth` — before `readJson`, before Zod, and before `registerCustomer`
 * reaches the database.
 */
export const POST = withAuth(
  { role: "public", rateLimit: RATE_LIMITS.register },
  async (request) => {
    const body = await readJson(request)
    if (!body.ok) return body.response

    const parsed = registerSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const result = await registerCustomer(parsed.data)

    if (!result.ok) {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { email: [REGISTER_ERRORS[result.reason]] },
        },
        { status: 409 },
      )
    }

    return Response.json(
      { userId: result.userId, customerId: result.customerId, linked: result.linked },
      { status: 201 },
    )
  },
)
