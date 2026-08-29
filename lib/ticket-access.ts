import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isStaff, type Role } from "@/lib/roles"

export type Viewer =
  /** AGENT or ADMIN. Sees every ticket; the customer scope never applies. */
  | { kind: "staff"; id: string; role: Role }
  /** A CUSTOMER with a linked `Customer` row. Scoped to `customerId`. */
  | { kind: "customer"; id: string; customerId: string }
  /**
   * A CUSTOMER login with **no** `Customer` row. Should not happen after Story
   * 04, but an admin can create a login without ever linking a profile.
   * Handled defensively: an empty list, never a 500, and never a fallback to
   * matching on email.
   */
  | { kind: "orphan"; id: string }

/**
 * Resolves the caller once per request. Returns a `Response` to send back when
 * there is no session at all — the same `{ ok } | { response }` shape
 * `readJson` uses in `lib/api/http.ts:36–45`.
 *
 * The customer lookup goes through **`Customer.userId`** and nothing else.
 * There is deliberately no email-matching fallback: `Customer.userId`
 * (`prisma/schema.prisma:43–44`) is the contract Story 04 established, and a
 * second, weaker way to answer "whose profile is this?" is a security bug.
 */
export async function resolveViewer(): Promise<
  { ok: true; viewer: Viewer } | { ok: false; response: Response }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { id, role } = session.user
  if (isStaff(role)) return { ok: true, viewer: { kind: "staff", id, role } }

  const customer = await prisma.customer.findUnique({
    where: { userId: id },
    select: { id: true },
  })

  return customer
    ? { ok: true, viewer: { kind: "customer", id, customerId: customer.id } }
    : { ok: true, viewer: { kind: "orphan", id } }
}

/**
 * The `where` fragment that scopes a ticket query to a viewer. Staff get `{}` —
 * no scoping. An orphan gets a clause that matches nothing, so the caller gets
 * `[]` rather than an error or a leak.
 */
export function ticketScopeWhere(viewer: Viewer) {
  if (viewer.kind === "staff") return {}
  if (viewer.kind === "customer") return { customerId: viewer.customerId }
  return { customerId: "__none__" }
}

export type AssignmentDecision = { allowed: true } | { allowed: false; reason: string }

/**
 * **Field-level** authorisation for a change to `assignedAgentId`. This is
 * deliberately not a route-level guard: the same `PATCH` handler is legal or
 * illegal depending on what the field is moving from and to.
 *
 *   current -> next         | who may do it
 *   -----------------------------------------------------------------
 *   x -> x   (no change)    | anyone who may PATCH the ticket
 *   null -> self            | any AGENT or ADMIN  (claiming)
 *   self -> null            | the assignee, or an ADMIN  (releasing)
 *   other -> null           | ADMIN only
 *   null|other -> other     | ADMIN only  (reassigning to a named agent)
 *   other -> self           | ADMIN only  (no stealing)
 */
export function authorizeAssignmentChange(
  current: string | null,
  next: string | null,
  viewer: { id: string; role: Role },
): AssignmentDecision {
  if (current === next) return { allowed: true }

  if (viewer.role === "ADMIN") return { allowed: true }

  if (next === null) {
    return current === viewer.id
      ? { allowed: true }
      : { allowed: false, reason: "Only the current assignee or an admin can release this ticket." }
  }

  if (next === viewer.id) {
    return current === null
      ? { allowed: true }
      : { allowed: false, reason: "This ticket is already assigned. Only an admin can reassign it." }
  }

  return { allowed: false, reason: "Only an admin can assign a ticket to another agent." }
}
