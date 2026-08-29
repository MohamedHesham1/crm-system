"use server"

import { AuthError } from "next-auth"
import { z } from "zod"

import { signIn } from "@/auth"
import { REGISTER_ERRORS, registerCustomer } from "@/lib/registration"
import { registerSchema } from "@/lib/validation/register"

export type RegisterState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const result = await registerCustomer(parsed.data)
  if (!result.ok) {
    return { fieldErrors: { email: [REGISTER_ERRORS[result.reason]] } }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/portal",
    })
  } catch (error) {
    // `signIn` with `redirectTo` signals success by throwing NEXT_REDIRECT.
    // Only `AuthError` may be swallowed; everything else MUST be rethrown or
    // the user is left signed in, staring at the register form.
    if (error instanceof AuthError) {
      return { error: "Your account was created. Please sign in." }
    }
    throw error
  }

  return {}
}
