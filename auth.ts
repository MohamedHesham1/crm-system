import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { checkRateLimit, clientIp, RATE_LIMITS, recordAttempt } from "@/lib/rate-limit"
import { loginSchema } from "@/lib/validation/auth"
import { isRole } from "@/lib/roles"

/**
 * `authorize()` cannot set an HTTP status — Auth.js owns the response for the
 * credentials callback — so a throttled attempt surfaces as this error code
 * rather than a literal 429. `app/(auth)/login/actions.ts` turns it into the
 * "too many attempts" message. See the guardrails story plan's Edge Cases for
 * why this is not done in `middleware.ts`.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate-limited"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw)
        if (!parsed.success) return null

        // Only **failures** are charged (`recordAttempt` below), so someone
        // signing in correctly ten times in a row is never throttled.
        const key = `login:${clientIp(request)}`
        if (!checkRateLimit(key, RATE_LIMITS.login).ok) throw new RateLimitedSignin()

        const { email, password } = parsed.data
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          recordAttempt(key)
          return null
        }

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) {
          recordAttempt(key)
          return null
        }
        if (!isRole(user.role)) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
})
