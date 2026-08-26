export const ROLES = ["AGENT", "CUSTOMER"] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** Landing route for a role. Used by `/` and by the post-login redirect. */
export function homeForRole(role: Role): "/agent" | "/portal" {
  return role === "AGENT" ? "/agent" : "/portal"
}
