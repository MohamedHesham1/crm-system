export const ROLES = ["AGENT", "CUSTOMER", "ADMIN"] as const
export type Role = (typeof ROLES)[number]

/**
 * The one source of truth for per-role routing and staff status. The
 * `Record<Role, …>` annotation is load-bearing: adding a role to `ROLES`
 * without giving it a `home` and an `isStaff` value is a compile error
 * (TS2741), not a silent runtime misroute.
 */
const ROLE_CONFIG: Record<Role, { home: "/agent" | "/portal"; isStaff: boolean }> = {
  AGENT: { home: "/agent", isStaff: true },
  ADMIN: { home: "/agent", isStaff: true },
  CUSTOMER: { home: "/portal", isStaff: false },
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** Landing route for a role. Used by `/`, by middleware, and by the post-login redirect. */
export function homeForRole(role: Role): "/agent" | "/portal" {
  return ROLE_CONFIG[role].home
}

/** True for roles that belong in the agent area. ADMIN is a strict superset of AGENT. */
export function isStaff(role: Role): boolean {
  return ROLE_CONFIG[role].isStaff
}
