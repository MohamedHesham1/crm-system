import { readJson, validationError } from "@/lib/api/http"
import { REGISTER_ERRORS, registerCustomer } from "@/lib/registration"
import { registerSchema } from "@/lib/validation/register"

/**
 * **Public on purpose** — no `requireAgent()` / `requireAdmin()`. `middleware.ts`
 * excludes `/api/**` from its matcher (line 37), so nothing else guards this
 * route either. That is the intended design, not an oversight.
 */
export async function POST(request: Request) {
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
}
