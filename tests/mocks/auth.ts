import type { Role } from "@/lib/roles"

export type SessionUser = { id: string; name: string; email?: string; role: Role }

let current: SessionUser | null = null

/** `null` = signed out, which is what produces every 401 in the suite. */
export function signInAs(user: SessionUser | null): void {
  current = user
}

/** Stands in for `auth()` in `auth.ts:10`. */
export async function auth() {
  return current ? { user: { ...current } } : null
}

// `auth.ts` exports four names. Anything importing one of the other three from
// a mocked `@/auth` must fail loudly rather than get `undefined`.
export const handlers = {
  GET: () => {
    throw new Error("Auth handlers are not available in tests.")
  },
  POST: () => {
    throw new Error("Auth handlers are not available in tests.")
  },
}
export const signIn = () => {
  throw new Error("signIn is not available in tests.")
}
export const signOut = () => {
  throw new Error("signOut is not available in tests.")
}
