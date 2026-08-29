# Story 05 — Ticket CRUD, self-pickup assignment, and comment thread

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). This story consumes, and does **not** re-implement: `lib/prisma.ts` (the `prisma` singleton — **never** `new PrismaClient()` in application code; `prisma/seed.ts` is the one sanctioned exception), `auth.ts`'s Node-runtime `auth()`, `app/providers.tsx` (`SessionProvider` + a single TanStack `QueryClientProvider`, mounted at `app/layout.tsx:28` — **do not add a second provider**), `lib/roles.ts`, `app/agent/layout.tsx`, `app/portal/layout.tsx`, `components/agent/sidebar-nav.tsx`, `components/portal/top-nav.tsx`.
- **Story 02 completed and committed** ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), commit `fff097a`). It owns the `Customer` model, `requireAgent()`, the `lib/customers.ts` client-module idiom, and the `RouteContext<…>` / `PageProps<…>` + `await params` pattern (`app/api/customers/[id]/route.ts:7`, `app/agent/customers/[id]/page.tsx:3–4`).
- **Story 03 completed and committed** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`). It owns `requireAdmin()` and `isStaff()` — both load-bearing for the assignment rules and the sweep endpoint — plus `lib/api/http.ts` (`readJson`, `validationError`, `notFound`) and `lib/api/client.ts` (`ApiError`, `FieldErrors`, `request<T>()`).
- **Story 04 is implemented but NOT yet committed** ([`../registration/04-story-customer-self-registration-with-automatic-account-linking.md`](../registration/04-story-customer-self-registration-with-automatic-account-linking.md)). `git status` shows `app/(auth)/register/`, `app/api/register/`, `lib/registration.ts`, `lib/validation/email.ts`, `lib/validation/register.ts`, and `prisma/migrations/20260829011949_add_customer_user_link/` as untracked, and `prisma/schema.prisma`, `prisma/seed.ts`, `middleware.ts` as modified. **Commit Story 04 before starting this one.** This story hard-depends on `Customer.userId` (`prisma/schema.prisma:43–44`) — the intake is explicit that if that column is missing you **flag it and stop**, and never fall back to matching `Ticket.customer.email` against `session.user.email`.
- **Versions are pinned and must not move.** Verified on disk: `next@16.3.3`, `react@19.2.8`, `prisma@6.19.3`, `@prisma/client@6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`, `radix-ui@1.6.7`, `shadcn@^4.19.0`. **Do not run `npm install <pkg>@latest`** — the intake pins Prisma at 6.19.3.
- **Two new shadcn/ui components are required.** `components/ui/` currently holds only `button`, `card`, `input`, `label`, `table`, `textarea`. Task 13 adds `select` and `badge`.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — no `test`. `## Test Plan` below is manual + `curl`, matching Stories 01–04.

---

## Story Goal

Ship the core ticket workflow on top of the Story 04 customer↔login link:

1. **`Ticket` and `Comment` Prisma models** with a committed SQLite migration, and the `Customer.tickets` back-reference that `prisma/schema.prisma:46–48` has had a `TODO` for since Story 02.
2. **Every new ticket starts unassigned** (`assignedAgentId = null`) and lands in a visible unassigned queue. Any staff member can **claim** it; only the current assignee or an ADMIN can release it; only an ADMIN can hand it to a *different* named agent.
3. **An admin-triggered assignment sweep** (`POST /api/tickets/assign-sweep`) that claims aging unassigned tickets on behalf of the least-loaded AGENT. **Manually triggered — there is no scheduler in this story.**
4. **A computed SLA-breach flag**, calculated at read time. **No stored column.**
5. **A comment thread** that refetches every 8 s while the ticket detail page is open. Polling, **not** WebSockets.
6. **Customer-scoped portal access** driven exclusively by `Customer.userId`, so a signed-in CUSTOMER sees, and can comment on, only their own tickets.

**Not in scope** (from the intake): email/WhatsApp/SMS delivery, AI-suggested replies or auto-categorisation, a real scheduled/background assignment job, WebSocket push, notifications/alerts, audit logging, CSAT.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — all 49 lines. **Lines 46–48** are the `TODO(Story 03)` comment reserving `tickets Ticket[]` on `Customer`; task 1 replaces it. **Lines 43–44** are `Customer.userId` / the `user` relation — the *only* supported path from a login to a customer profile. **Lines 10–12** explain why `role` is a `String` and not a Prisma `enum`: **SQLite has no `enum`**. `Ticket.priority` and `Ticket.status` follow that same rule.
2. `prisma/migrations/20260829011949_add_customer_user_link/migration.sql` — all 20 lines. What Prisma emits for SQLite when a foreign key is involved (a full table redefinition). Task 2's migration is a plain `CreateTable` pair by comparison, but read this to recognise the house style.
3. `lib/api/http.ts` — all 45 lines. `requireAgent()` (11–16, **accepts AGENT *and* ADMIN**), `requireAdmin()` (19–24), `validationError` (26–29), `notFound` (31–33), `readJson` (36–45). The comment at lines 6–9 states the rule this story lives by: **`middleware.ts` excludes `/api/**` from its matcher (line 37), so every route handler guards itself.**
4. `lib/roles.ts` — all 28 lines. `ROLE_CONFIG` (10–14), `isStaff` (26–28, true for AGENT and ADMIN), `homeForRole` (21–23). Assignment authorisation calls `isStaff`; the sweep's candidate pool is `role === "AGENT"` **only** — read the acceptance criteria wording again before widening it.
5. `app/api/customers/[id]/route.ts` — all 59 lines. The exact shape task 7 copies: `RouteContext<"/api/customers/[id]">` at lines 7 and 19, `await ctx.params` at 11 and 23, `readJson` → `safeParse` → `validationError`, the "provide at least one field" guard (37–39), and the `P2025 → notFound` / `P2002 → 409` mapping (44–57).
6. `app/api/customers/route.ts` — all 48 lines. `GET` guarded by `requireAgent()` with an explicit `select` (11–14); `POST` returning `201` (line 35). Task 6 mirrors this.
7. `app/api/admin/users/route.ts` — lines 8–18. `requireAdmin()` first, then the query. Task 10's sweep endpoint opens exactly this way. Note the `select` at line 14 — **`passwordHash` is never selected**; the same discipline applies to every `User` sub-select in this story.
8. `lib/registration.ts` — lines 43–93. The house pattern for server-side domain logic: an exported function, a discriminated result union instead of thrown errors for expected failures, `prisma.$transaction` for multi-write invariants, and a `catch` that maps `P2002`. Tasks 5 and 10 follow this shape. Also read the doc comment at 27–42 — the way a **known limitation is recorded in code, not only in a plan**.
9. `lib/customers.ts` — all 55 lines. The client data-module contract: an exported row type, a `*Keys` factory (25–29), and one thin `request<T>()` wrapper per endpoint. **Lines 15–18 are the trap to remember:** `createdAt` / `updatedAt` are `Date` in Prisma but arrive as **ISO strings** through `Response.json`. Task 12's ticket types must declare `dueAt` and `createdAt` as `string`.
10. `lib/api/client.ts` — all 33 lines. `request<T>()` sets `Content-Type` only when there is a body (line 19) and throws `ApiError` carrying `status` + `fieldErrors` (25–29). **Import `ApiError` from here, never redefine it** — a second class breaks every `instanceof` check.
11. `components/agent/customers/customer-table.tsx` — all 53 lines. The `useQuery` + `isPending` / `isError` / empty-state ladder (15–27) and the `font-medium hover:underline` row link (42). Task 14 extends this with filter state.
12. `components/agent/customers/customer-profile.tsx` — all 101 lines. `useQuery` + `useMutation` + `queryClient.setQueryData` / `invalidateQueries` (24–28) and the `role="alert" className="text-sm text-destructive"` paragraph (92–96). Task 16 is this file with more controls.
13. `components/agent/customers/customer-form.tsx` — all 162 lines. Controlled `Values` state, client-side `safeParse` before `mutate` (52–56), `z.flattenError(...).fieldErrors` into `setFieldErrors`, `aria-invalid={Boolean(fieldErrors.x)}`, the `router.push` + invalidate on success (34–37), and the `formError` derivation at 62–65. Tasks 19 and 20 copy this whole shape.
14. `app/providers.tsx` — lines 10–15. `defaultOptions.queries` sets **`staleTime: 30_000`** and **`refetchOnWindowFocus: false`**. Task 17's comment query must set its **own** `staleTime: 0` alongside `refetchInterval` — a 30 s stale time does not stop an interval refetch, but leaving it makes the first mount serve stale cache.
15. `app/agent/layout.tsx` — lines 10–13 (session + `isStaff` redirect) and `app/agent/admin/layout.tsx` — line 11 (ADMIN narrowing, **redirect, never a 403 page**). New agent pages inherit the first for free.
16. `app/portal/layout.tsx` — lines 10–11. `CUSTOMER`-only. Portal ticket pages inherit it; they still need the per-row ownership check, because the layout proves *a* customer, not *which* customer.
17. `components/agent/sidebar-nav.tsx` — lines 9–18. `BASE_LINKS` / `ADMIN_LINKS` and the `startsWith` active check at 23–24. Task 21 adds one entry to `BASE_LINKS`.
18. `prisma/seed.ts` — lines 22–45 (the `customer@crm.local` user and its **linked** `Customer` upsert) and 82–94 (the unlinked `*.example` loop and the summary). Task 11 appends after line 88 and edits the summary.
19. `lib/validation/customer.ts` and `lib/validation/email.ts` — all of both. The zod idiom: `.trim().min(1, "X is required.").max(N, "X must be N characters or fewer.")`, `createXSchema.partial()` for PATCH, and the shared `emailField`. Task 4 matches these strings exactly.
20. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — **lines 107–121**. `RouteContext<'/users/[id]'>` is a **globally available generated helper; it is not imported.** Confirm before writing tasks 7–10.
21. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — **lines 125–140**. Same for `PageProps<'/blog/[slug]'>`.
22. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — confirm route resolution before creating `app/api/tickets/assign-sweep/route.ts` next to `app/api/tickets/[id]/route.ts`. See Edge Cases: the static segment must win.
23. Grep for `refetchInterval` across `app/`, `lib/`, `components/` before you start: **zero hits.** Task 17 introduces the first polling query in this repo.
24. Grep for `QueryMode` in `node_modules/.prisma/client/index.d.ts`: **zero hits.** SQLite has no case-insensitive Prisma filter. Any text comparison in this story is case-**sensitive**; do not attempt `mode: "insensitive"`.

---

## Product rules (from story)

| Concern | Before (Story 04) | After (Story 05) |
|---|---|---|
| Tickets | No `Ticket` model exists | `Ticket` + `Comment` models, full agent CRUD |
| A newly created ticket | — | **Always unassigned**, unless an agent ticks "assign to me" at creation |
| Claiming an unassigned ticket | — | Any **AGENT or ADMIN** may claim (`null → self.id`) |
| Releasing a ticket | — | The **current assignee** or an **ADMIN** (`self.id → null`) |
| Handing a ticket to a different named agent | — | **ADMIN only.** A non-admin attempt is `403` |
| Stealing an already-assigned ticket | — | **Refused** for non-admins, even to claim it for themselves |
| Aging unassigned tickets | — | `POST /api/tickets/assign-sweep`, **ADMIN only, manual** |
| A `CLOSED` ticket | — | `PATCH` cannot change its status; `POST /api/tickets/[id]/reopen` sets it back to `OPEN` |
| SLA breach | — | **Computed at read time**: `dueAt < now()` and status not `RESOLVED`/`CLOSED`. No column |
| What a CUSTOMER can see | Nothing ticket-shaped | Only tickets whose `customerId` is the `Customer` with `userId === session.user.id` |
| A CUSTOMER with no linked `Customer` row | — | **Empty list, `200`** — never a `500`, never someone else's data |
| Comment thread freshness | — | Client polls every **8 s** while the page is open |

**Additive only.** No Story 01–04 endpoint, page, or schema field changes behaviour. The only edits to existing files are: `prisma/schema.prisma` (add models + back-references), `prisma/seed.ts` (append), `components/agent/sidebar-nav.tsx` (one link), `components/portal/top-nav.tsx` (one link).

---

## Backend Tasks

### 1 — `prisma/schema.prisma`: `Ticket` and `Comment`

**File: `prisma/schema.prisma`**

Replace the `TODO(Story 03)` comment at **lines 46–48** with the real relation:

```prisma
  tickets   Ticket[]
```

Add the back-references to `User`, after `customer Customer?` (**line 24**):

```prisma
  /// Tickets this staff member currently owns. Empty for CUSTOMER logins —
  /// a customer sits on the `Ticket.customer` side, never this one.
  assignedTickets Ticket[]
  comments        Comment[]
```

Append the two new models at the end of the file:

```prisma
/// Support tickets. `priority` and `status` are Strings, not Prisma enums —
/// SQLite has no `enum` support, exactly as with `User.role` (see line 10).
/// The allowed values live in `lib/validation/ticket.ts` and nowhere else.
model Ticket {
  id              String    @id @default(cuid())
  subject         String
  description     String
  /// Free text chosen by the reporter. Deliberately not constrained to a
  /// fixed list — auto-categorisation is explicitly out of scope.
  category        String
  /// "LOW" | "MEDIUM" | "HIGH"
  priority        String
  /// "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  status          String    @default("OPEN")

  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id], onDelete: Restrict)

  /// **NULL means unassigned** — the queue state every ticket starts in.
  /// Not a data gap. `onDelete: SetNull` so removing a staff account returns
  /// their tickets to the queue instead of deleting history.
  assignedAgentId String?
  assignedAgent   User?     @relation(fields: [assignedAgentId], references: [id], onDelete: SetNull)

  /// SLA deadline. Nullable: a ticket with no `dueAt` can never breach and is
  /// never picked up by the assignment sweep. Defaulted from `priority` at
  /// creation time by `lib/sla.ts`, not by the database.
  dueAt           DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  comments        Comment[]

  @@index([status])
  @@index([assignedAgentId])
  @@index([customerId])
}

/// One message on a ticket thread. Agents and customers both write here;
/// `author.role` is what the UI uses to tell them apart.
model Comment {
  id        String   @id @default(cuid())

  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  authorId  String
  /// `Restrict`: an account with comments cannot be deleted out from under the
  /// thread. There is no delete-user endpoint yet (Story 03 shipped create +
  /// list only), so this is a guarantee waiting for a caller.
  author    User     @relation(fields: [authorId], references: [id], onDelete: Restrict)

  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, createdAt])
}
```

- **No `@relation("name")` anywhere.** Prisma requires a relation name only when two relations connect the **same pair** of models. `Ticket↔User` and `Comment↔User` are different pairs, so the implicit names are unambiguous. Adding names here compiles but is noise.
- **`onDelete: Restrict` on `Ticket.customer` is deliberate**, and differs from the `SetNull` Story 04 used on `Customer.user`. `customerId` is **non-nullable** — `SetNull` is not representable — and `Cascade` would silently destroy a customer's entire ticket history the first time someone builds a delete-customer endpoint. `Restrict` makes that attempt fail loudly instead.
- **`onDelete: Cascade` on `Comment.ticket` is equally deliberate.** Deleting a ticket must take its thread with it; `DELETE /api/tickets/[id]` (task 7) relies on this and does **not** delete comments by hand.
- **`status` has `@default("OPEN")`; `priority` deliberately does not.** Priority is always an explicit choice by the reporter; a silent default would hide a validation bug.
- **Do not** add an `slaBreached` column. The acceptance criteria are explicit that the flag is computed.

---

### 2 — The migration

Run in the repo root:

```bash
cp prisma/dev.db prisma/dev.db.bak
npx prisma migrate dev --name add_ticket_and_comment
```

- **Read the generated SQL before committing it.** Expect two plain `CreateTable` statements plus four `CreateIndex` statements — **not** a `new_Ticket` table redefinition. A redefinition here means an existing table was also changed; back out whatever caused it.
- Confirm the file lands at `prisma/migrations/<timestamp>_add_ticket_and_comment/migration.sql` and contains `Ticket_status_idx`, `Ticket_assignedAgentId_idx`, `Ticket_customerId_idx`, and `Comment_ticketId_createdAt_idx`.
- `Customer` and `User` gain **no columns** — the back-references are virtual. If the diff touches either table, task 1 is wrong.
- `npx prisma generate` runs as part of `migrate dev`; the `postinstall` script covers a fresh clone.

---

### 3 — `lib/sla.ts`: the computed flag and the default deadline

**Create file: `lib/sla.ts`**

Pure functions only — **no `@/lib/prisma` import, no `@/auth` import.** Both route handlers and client components import from here, so a server-only dependency would break the client bundle.

```ts
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

/** Statuses that stop the SLA clock. A resolved ticket can never breach. */
const TERMINAL_STATUSES: readonly TicketStatus[] = ["RESOLVED", "CLOSED"]

/**
 * Hours from creation to `dueAt`, per priority. Applied only when the reporter
 * did not supply an explicit `dueAt`.
 *
 * These numbers are a product decision made in this story, not something the
 * acceptance criteria fixed: the criteria require `dueAt` to be nullable and
 * require the sweep to act on "SLA window more than half elapsed", which is
 * unreachable if `dueAt` is always null. Change the table freely; do not move
 * it into the database.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  HIGH: 4,
  MEDIUM: 24,
  LOW: 72,
}

export function defaultDueAt(priority: TicketPriority, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000)
}

/**
 * The computed breach flag — `dueAt` in the past and the ticket still live.
 * **There is no stored column**; every read path calls this. Accepts ISO
 * strings as well as `Date`s so the same function works on a Prisma row and on
 * the JSON a client received.
 */
export function isSlaBreached(
  ticket: { dueAt: Date | string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!ticket.dueAt) return false
  if (TERMINAL_STATUSES.includes(ticket.status as TicketStatus)) return false
  return new Date(ticket.dueAt).getTime() < now.getTime()
}

/**
 * True when more than half the createdAt→dueAt window has elapsed. This is the
 * sweep's eligibility test (task 10). A ticket with no `dueAt` has no window
 * and is **never** eligible.
 */
export function isSlaHalfElapsed(
  ticket: { createdAt: Date | string; dueAt: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!ticket.dueAt) return false
  const start = new Date(ticket.createdAt).getTime()
  const end = new Date(ticket.dueAt).getTime()
  if (end <= start) return true
  return now.getTime() >= start + (end - start) / 2
}
```

---

### 4 — `lib/validation/ticket.ts`

**Create file: `lib/validation/ticket.ts`**

```ts
import { z } from "zod"

/**
 * The single source of truth for the two String-backed enums on `Ticket`.
 * SQLite has no Prisma `enum` (see `prisma/schema.prisma:10–12`), so the
 * constraint lives here and is enforced by every write path.
 */
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]
export type TicketStatus = (typeof TICKET_STATUSES)[number]

const subject = z
  .string()
  .trim()
  .min(1, "Subject is required.")
  .max(200, "Subject must be 200 characters or fewer.")

const description = z
  .string()
  .trim()
  .min(1, "Description is required.")
  .max(10_000, "Description must be 10,000 characters or fewer.")

const category = z
  .string()
  .trim()
  .min(1, "Category is required.")
  .max(60, "Category must be 60 characters or fewer.")

const priority = z.enum(TICKET_PRIORITIES, { message: "Choose LOW, MEDIUM or HIGH." })

/** Agent-side creation. `customerId` is required; the portal schema has none. */
export const createTicketSchema = z.object({
  subject,
  description,
  category,
  priority,
  customerId: z.string().min(1, "Choose a customer."),
  dueAt: z.iso.datetime({ message: "Enter a valid date and time." }).optional(),
  /** Opt-in self-assignment at creation. Absent or false means unassigned. */
  assignToMe: z.boolean().optional(),
})

/**
 * Portal-side creation. **No `customerId` and no `assignToMe`** — the owning
 * customer comes from the session, never from the body, and a customer can
 * never assign an agent.
 */
export const createPortalTicketSchema = z.object({
  subject,
  description,
  category,
  priority,
})

/**
 * PATCH accepts any subset. `assignedAgentId` is `.nullable()` because **`null`
 * is a meaningful value** — it is how a ticket is released back to the queue.
 * `undefined` (key absent) means "leave assignment alone"; the route handler
 * must distinguish the two with `in`, not with a truthiness check.
 */
export const updateTicketSchema = z.object({
  subject: subject.optional(),
  description: description.optional(),
  category: category.optional(),
  priority: priority.optional(),
  status: z.enum(TICKET_STATUSES, { message: "Choose a valid status." }).optional(),
  assignedAgentId: z.string().min(1).nullable().optional(),
  dueAt: z.iso.datetime({ message: "Enter a valid date and time." }).nullable().optional(),
})

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a comment before posting.")
    .max(10_000, "Comment must be 10,000 characters or fewer."),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type CreatePortalTicketInput = z.infer<typeof createPortalTicketSchema>
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
```

- Message wording matches `lib/validation/customer.ts` exactly ("X is required.", "X must be N characters or fewer."). Do not invent a new phrasing.
- `z.iso.datetime()` is the Zod 4 form. **Do not** use the deprecated `z.string().datetime()` chaining — Story 03 already ruled that style out for `.email()`.

---

### 5 — `lib/ticket-access.ts`: viewer scoping and field-level assignment authorisation

**Create file: `lib/ticket-access.ts`**

The **single** implementation of both authorisation rules. Route handlers call it; none of them re-derive the logic.

```ts
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
```

- **`authorizeAssignmentChange` takes no `prisma` and no `Request`.** It is a pure decision function, so the whole truth table above is readable in one screen and testable the day a runner exists.
- The early `if (viewer.role === "ADMIN") return { allowed: true }` is what collapses every ADMIN row of the table into one line. Do not duplicate admin checks further down.

---

### 6 — `app/api/tickets/route.ts`

**Create file: `app/api/tickets/route.ts`**

**`GET`** — list, scoped and filtered.

- `resolveViewer()` first; return its `response` when not ok.
- Read filters from `new URL(request.url).searchParams`: `status` (must be in `TICKET_STATUSES` or it is ignored), `priority` (same against `TICKET_PRIORITIES`), and `assigned` — `"me"` means `assignedAgentId: viewer.id`, `"none"` means `assignedAgentId: null`. **An unrecognised filter value is ignored, not a `400`** — these come from URL state, and a stale bookmark must not error.
- `where: { ...ticketScopeWhere(viewer), ...filters }`. The scope spread goes **first** and the filters after, and **neither may set `customerId`** — a customer cannot pass `?customerId=` because the handler never reads one.
- `orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]`.
- Explicit `select`: `id, subject, category, priority, status, dueAt, createdAt`, plus `customer: { select: { id: true, name: true } }` and `assignedAgent: { select: { id: true, name: true } }`. **Never select `passwordHash`, and never select `customer.notes`** — the portal reads this endpoint too.
- Map each row to add `slaBreached: isSlaBreached(row)` before responding. Return `{ tickets }`.

**`POST`** — create.

- `resolveViewer()`, then `readJson(request)`.
- **Branch on `viewer.kind` and use a different schema per branch:**
  - `staff` → `createTicketSchema`. `customerId` comes from the body; verify the customer exists with `prisma.customer.findUnique` and return `notFound("Customer not found.")` if it does not. `assignedAgentId` is `parsed.data.assignToMe ? viewer.id : null` — **an `assignedAgentId` in the body, if someone sends one, is ignored entirely.**
  - `customer` → `createPortalTicketSchema`. `customerId` is `viewer.customerId`, `assignedAgentId` is **always `null`**.
  - `orphan` → `Response.json({ error: "No customer profile is linked to this account." }, { status: 403 })`. A ticket with no owner is not representable.
- `status: "OPEN"`. `dueAt` is `parsed.data.dueAt ? new Date(parsed.data.dueAt) : defaultDueAt(parsed.data.priority)` in the staff branch; the portal branch always uses `defaultDueAt`.
- `return Response.json({ ticket }, { status: 201 })` with `slaBreached` attached, matching `app/api/customers/route.ts:35`.

---

### 7 — `app/api/tickets/[id]/route.ts`

**Create file: `app/api/tickets/[id]/route.ts`**

Use `RouteContext<"/api/tickets/[id]">` and `await ctx.params`, exactly as `app/api/customers/[id]/route.ts:7,11`.

**`GET`** — ticket + customer + agent + comments (what the acceptance criteria specify).

- `resolveViewer()`, then `findFirst({ where: { id, ...ticketScopeWhere(viewer) } })`.
- **`findFirst` with the scope inside the `where`, not `findUnique` followed by an ownership `if`.** A single query cannot leak the row it refuses to return, and a customer requesting someone else's id gets the same `notFound("Ticket not found.")` a nonexistent id gets — **no existence oracle**.
- Sub-selects: customer (`id, name, email, company`), `assignedAgent` (`id, name, email`), and `comments` ordered `createdAt: "asc"` with `author: { select: { id: true, name: true, role: true } }`.
- Attach `slaBreached`. Return `{ ticket }`.

**`PATCH`** — where the field-level assignment rules are applied.

- `resolveViewer()`. **Staff only** — `viewer.kind !== "staff"` returns `403`. A customer cannot edit a ticket, only comment on it.
- `readJson` → `updateTicketSchema.safeParse` → `validationError`.
- Reject an empty patch with the same message `app/api/customers/[id]/route.ts:38` uses: `"Provide at least one field to update."`
- Load the current row: `select: { id: true, status: true, assignedAgentId: true }`. `notFound("Ticket not found.")` when absent.
- **Assignment gate** — run *before* any write:

```ts
if ("assignedAgentId" in parsed.data) {
  const next = parsed.data.assignedAgentId ?? null
  const decision = authorizeAssignmentChange(current.assignedAgentId, next, viewer)
  if (!decision.allowed) return Response.json({ error: decision.reason }, { status: 403 })

  if (next !== null) {
    const target = await prisma.user.findUnique({ where: { id: next }, select: { role: true } })
    if (!target || !isRole(target.role) || !isStaff(target.role)) {
      return Response.json(
        { error: "Validation failed", fieldErrors: { assignedAgentId: ["Choose a staff account."] } },
        { status: 400 },
      )
    }
  }
}
```

  **Use `in`, not `parsed.data.assignedAgentId !== undefined` folded into a truthiness check.** `null` is a real, intentional value here, and `if (parsed.data.assignedAgentId)` silently drops every release.
- **Reopen gate:** if `current.status === "CLOSED"` and `parsed.data.status` is present and different, return
  `Response.json({ error: "This ticket is closed. Use the reopen action to move it back to OPEN." }, { status: 409 })`.
  A `CLOSED → CLOSED` no-op is fine, and edits to non-status fields on a closed ticket are allowed.
- Write with `prisma.ticket.update`, converting `dueAt` with `new Date(...)` when it is a string and passing `null` through unchanged. Map `P2025 → notFound("Ticket not found.")`, matching `app/api/customers/[id]/route.ts:46`.
- Respond with the same enriched shape `GET` returns, so the client can `setQueryData` the detail cache directly.

**`DELETE`**

- `requireAdmin()` — deleting a ticket destroys its thread. **Not `requireAgent()`.**
- `prisma.ticket.delete({ where: { id } })`; comments go with it through `onDelete: Cascade` (task 1). **Do not delete comments by hand.**
- `P2025 → notFound("Ticket not found.")`. Return `Response.json({ ok: true })`.

---

### 8 — `app/api/tickets/[id]/reopen/route.ts`

**Create file: `app/api/tickets/[id]/reopen/route.ts`**

`POST` only. `resolveViewer()`, staff-only, load the row, then:

- `status !== "CLOSED"` returns `Response.json({ error: "This ticket is not closed." }, { status: 409 })`.
- Otherwise `update({ data: { status: "OPEN" } })` and return the same enriched shape as `GET /api/tickets/[id]`.

This endpoint exists **only** so the "explicit reopen action" in the acceptance criteria is a distinct call rather than a status value the ordinary `PATCH` happens to accept. It takes **no request body**.

---

### 9 — `app/api/tickets/[id]/comments/route.ts`

**Create file: `app/api/tickets/[id]/comments/route.ts`**

Both verbs start by resolving the viewer and re-checking ownership with the same `findFirst({ where: { id, ...ticketScopeWhere(viewer) } })` shape as task 7. **Do not trust that the client only polls tickets it can see.**

**`GET`** — the endpoint task 17 polls. Returns `{ comments }` ordered `createdAt: "asc"`, each with `author: { select: { id: true, name: true, role: true } }`. Kept separate from the detail route so an 8 s poll transfers a thread, not a whole ticket with its customer record.

**`POST`** — `readJson` → `createCommentSchema` → `validationError`. Then:

- `viewer.kind === "orphan"` needs no special branch — the ownership `findFirst` already returns nothing, so the caller gets `notFound("Ticket not found.")`.
- `authorId: viewer.id` — **from the session, never from the body.**
- Return `Response.json({ comment }, { status: 201 })` with the author sub-select attached.
- **A `CLOSED` ticket still accepts comments.** The reopen guard covers `status`, not the thread; the acceptance criteria do not lock a closed thread.

---

### 10 — `app/api/tickets/assign-sweep/route.ts`

**Create file: `app/api/tickets/assign-sweep/route.ts`** — a single `export async function POST()`.

- **`requireAdmin()` first**, exactly as `app/api/admin/users/route.ts:9`. That is the whole guard; there is no field-level nuance here.
- Candidate tickets: `assignedAgentId: null`, `status: { in: ["OPEN", "IN_PROGRESS"] }`, `dueAt: { not: null }`. Select `id, createdAt, dueAt`. Filter the result in JS with `isSlaHalfElapsed` from `lib/sla.ts` — **do not** try to express "half the window elapsed" as a Prisma `where`; it compares two columns, which Prisma on SQLite cannot do in a filter.
- Candidate agents: `prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true } })`. **`role: "AGENT"` only — ADMINs are not swept work onto**, per the acceptance criteria wording ("whichever AGENT"). If the list is empty, return `Response.json({ swept: 0, assignments: [], reason: "No agents available." })` — **`200`, not an error**.
- Current load per agent: one `groupBy` over open tickets —

```ts
const load = await prisma.ticket.groupBy({
  by: ["assignedAgentId"],
  where: { assignedAgentId: { not: null }, status: { in: ["OPEN", "IN_PROGRESS"] } },
  _count: { _all: true },
})
```

  Seed a `Map<string, number>` from **every candidate agent at `0`**, then overlay the counts. **An agent with zero open tickets is absent from `groupBy` output** — seeding from the agent list rather than from the query result is what stops them being skipped, which is the exact opposite of the intended behaviour.
- Assign oldest-`dueAt`-first. For each ticket pick the agent with the lowest running count (ties broken by `id`, for determinism), then **increment that agent's count in the map** before moving to the next ticket. Skipping the increment hands the entire backlog to one agent.
- Apply all updates inside one `prisma.$transaction([...])` so a partially applied sweep is not a reachable state, mirroring the reasoning in `lib/registration.ts:55`.
- Respond `Response.json({ swept: assignments.length, assignments })`, where each entry is `{ ticketId, agentId, agentName }`, so task 14's button can report "Assigned 3 tickets."
- **This is a manual admin action.** Add a doc comment saying so and naming the deferred alternative (a cron or queue worker), the way `lib/registration.ts:27–42` records its known limitation in code.

---

### 11 — `prisma/seed.ts`: one demo ticket

**File: `prisma/seed.ts`** — insert after the `CUSTOMERS` upsert loop (**ends line 88**) and before the `console.log` block (**line 90**).

- Re-read the linked profile the file already creates at lines 36–45:
  `const linkedCustomer = await prisma.customer.findUnique({ where: { email: "customer@crm.local" }, select: { id: true } })`.
  **This is the Story 04 link — add no email-matching logic here**, and do not create a second customer.
- `Ticket` has no natural unique key, so guard on subject + customer instead of using `upsert`:

```ts
const SEED_TICKET_SUBJECT = "Cannot export monthly invoice PDF"
const existingTicket = await prisma.ticket.findFirst({
  where: { customerId: linkedCustomer.id, subject: SEED_TICKET_SUBJECT },
  select: { id: true },
})
if (!existingTicket) {
  await prisma.ticket.create({ /* … */ })
}
```

  This keeps `npm run seed` **idempotent**, which Story 04's Test Plan item 2 established as the standard for this file.
- Field values: `category: "Billing"`, `priority: "MEDIUM"`, `status: "OPEN"`, **`assignedAgentId: null`** — the seeded ticket must demonstrate the unassigned queue, so do **not** assign it to `agent@crm.local`. `dueAt` via `defaultDueAt("MEDIUM")`.
- Extend the summary at lines 90–94 with a line reporting the seeded ticket, matching the existing tone.

---

## Frontend Tasks

### 12 — `lib/tickets.ts`: the client data module

**Create file: `lib/tickets.ts`**

Mirror `lib/customers.ts` exactly: exported row types, a `ticketKeys` factory, one thin `request<T>()` wrapper per endpoint.

```ts
import { request } from "@/lib/api/client"
import type { Role } from "@/lib/roles"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

export { ApiError } from "@/lib/api/client"
export type { FieldErrors } from "@/lib/api/client"

/**
 * `dueAt` / `createdAt` are `DateTime` in Prisma but arrive as ISO **strings**
 * — `Response.json` serialises them. Do not type them as `Date`.
 * `slaBreached` is computed by the server on every read; there is no column.
 */
export type TicketListItem = {
  id: string
  subject: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  dueAt: string | null
  createdAt: string
  slaBreached: boolean
  customer: { id: string; name: string }
  assignedAgent: { id: string; name: string } | null
}

export type TicketComment = {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string; role: Role }
}

export type TicketDetail = TicketListItem & {
  description: string
  customer: { id: string; name: string; email: string; company: string | null }
  assignedAgent: { id: string; name: string; email: string } | null
  comments: TicketComment[]
}

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned?: "me" | "none"
}

export const ticketKeys = {
  all: ["tickets"] as const,
  list: (filters: TicketFilters = {}) => [...ticketKeys.all, "list", filters] as const,
  detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
  comments: (id: string) => [...ticketKeys.all, "detail", id, "comments"] as const,
}
```

- **`ticketKeys.comments(id)` nests under `ticketKeys.detail(id)`**, so `invalidateQueries({ queryKey: ticketKeys.detail(id) })` after a status change also refreshes the thread. Deliberate; do not flatten it.
- **`ticketKeys.list(filters)` includes the filter object in the key.** Each filter combination is its own cache entry, so switching filters does not show the previous result while loading.
- Functions to export: `fetchTickets(filters)` (builds the query string with `URLSearchParams`, omitting empty values), `fetchTicket(id)`, `fetchComments(id)`, `createTicket(input)`, `createPortalTicket(input)`, `updateTicket(id, input)`, `postComment(id, input)`, `reopenTicket(id)`, `runAssignSweep()`. Input types come from `@/lib/validation/ticket`.
- `claimTicket` and `releaseTicket` are **not** separate functions — they are `updateTicket(id, { assignedAgentId: agentId })` and `updateTicket(id, { assignedAgentId: null })`. One endpoint, one wrapper.

---

### 13 — shadcn: `select` and `badge`

Run in the repo root:

```bash
npx shadcn@latest add select badge --base radix --preset nova
```

- `components.json` records `"style": "radix-nova"`, which is what `--base radix --preset nova` produces. Verified: the installed `shadcn@4.19.0` CLI accepts both `--base <base>` and `--preset <preset>`.
- **Review the generated files before committing.** They must import from the unified `radix-ui` package (`import { Select } from "radix-ui"`), matching `components/ui/button.tsx:3` (`import { Slot } from "radix-ui"`). A generated file importing `@radix-ui/react-select` means a new, unpinned dependency was pulled in — revert and re-run.
- If the CLI cannot reach the registry, hand-write a `Badge` (a `cva` variant span, following `components/ui/button.tsx:7–45`) and use a native `<select className="…">` styled like `components/ui/input.tsx`. **Do not add `@radix-ui/react-select` to `package.json` directly.**

---

### 14 — `components/agent/tickets/ticket-table.tsx`

**Create file: `components/agent/tickets/ticket-table.tsx`** — `"use client"`.

- Local `useState<TicketFilters>({})` for status / priority / assigned. Render three `Select`s plus a "Clear filters" ghost button.
- `useQuery({ queryKey: ticketKeys.list(filters), queryFn: () => fetchTickets(filters) })`, then the exact `isPending` → `isError` → empty-state ladder from `components/agent/customers/customer-table.tsx:15–27`. Empty text: `"No tickets match these filters."`
- Columns: Subject (a `Link` to `/agent/tickets/${id}`, styled `font-medium hover:underline` like `customer-table.tsx:42`), Customer, Priority (`Badge`), Status (`Badge`), Assignee, Due.
- **Assignee cell:** the agent's name, or the word `"Unassigned"` plus a `Claim` button when `assignedAgent === null`. The button calls `updateTicket(id, { assignedAgentId: session.user.id })`, with the id from `useSession()` (`SessionProvider` is already mounted at `app/providers.tsx:18`). `onSuccess` invalidates `ticketKeys.all`.
- **SLA indicator:** when `slaBreached`, render a `destructive` `Badge` reading `"SLA breached"` next to the due date. Do not recompute the flag in the browser — the server already sent it, and a client clock is not the SLA clock.
- **Admin-only "Run assignment sweep" button** above the table, rendered only when `session.user.role === "ADMIN"`. `useMutation(runAssignSweep)`; on success show `` `Assigned ${data.swept} ticket(s).` `` and invalidate `ticketKeys.all`. Show `data.reason` when `swept === 0` and a reason came back.
- **The button being hidden is not the security boundary** — `requireAdmin()` in task 10 is. Both exist on purpose.

---

### 15 — `app/agent/tickets/page.tsx`

**Create file: `app/agent/tickets/page.tsx`** — a server component copying `app/agent/customers/page.tsx` verbatim in shape: an `h1` reading `"Tickets"`, a `Button asChild size="sm"` linking to `/agent/tickets/new` labelled `"New ticket"`, then `<TicketTable />`. It inherits the staff guard from `app/agent/layout.tsx:12–13`; **no auth code in this file.**

---

### 16 — `components/agent/tickets/ticket-detail.tsx`

**Create file: `components/agent/tickets/ticket-detail.tsx`** — `"use client"`. Built on `components/agent/customers/customer-profile.tsx`.

- `useQuery({ queryKey: ticketKeys.detail(ticketId), queryFn: () => fetchTicket(ticketId) })` and the same three-state ladder.
- **Info panel:** subject as `h1`, then customer (a `Link` to `/agent/customers/${customer.id}`), category, created date, due date, and the destructive `"SLA breached"` `Badge` when `data.slaBreached`.
- **Status and priority `Select`s.** Each `onValueChange` fires `updateTicket(ticketId, { status })` / `{ priority }`; `onSuccess` calls `queryClient.setQueryData(ticketKeys.detail(ticketId), updated)` then invalidates `ticketKeys.all`, mirroring `customer-profile.tsx:24–28`.
- **When `data.status === "CLOSED"`:** disable the status `Select` and render a `"Reopen ticket"` button calling `reopenTicket`. The disabled control mirrors the server's `409`; it does not replace it.
- **Assignment controls**, driven by `useSession()`:
  - `assignedAgent === null` → `"Claim ticket"`.
  - `assignedAgent.id === session.user.id` → `"Release ticket"`.
  - `assignedAgent` is someone else and the viewer is **not** ADMIN → read-only text `` `Assigned to ${assignedAgent.name}` ``. No buttons.
  - `session.user.role === "ADMIN"` → additionally a `Select` of agents with a `"Reassign"` action, **plus** `"Release ticket"` regardless of who holds it.
- **Agent list for the reassign `Select`:** reuse `fetchUsers()` from `lib/users.ts` (`GET /api/admin/users`), filtered to `role === "AGENT"`. **Mount that query only when the viewer is ADMIN** (`enabled: session?.user.role === "ADMIN"`) — the endpoint returns `403` for anyone else, and an always-on query would put a red error in every agent's console. No new endpoint is needed.
- Render `<CommentThread ticketId={ticketId} />` (task 17) at the bottom.
- Every mutation error renders through the same `role="alert" className="text-sm text-destructive"` paragraph used at `customer-profile.tsx:92–96`. A `403` from the assignment gate surfaces its server message verbatim — `ApiError.message` already carries it (`lib/api/client.ts:26`).

---

### 17 — `components/agent/tickets/comment-thread.tsx`

**Create file: `components/agent/tickets/comment-thread.tsx`** — `"use client"`. Shared by the agent detail page and the portal detail page; **do not write a second copy under `components/portal/`.**

```tsx
const { data, isPending, isError } = useQuery({
  queryKey: ticketKeys.comments(ticketId),
  queryFn: () => fetchComments(ticketId),
  // Near-live thread by polling. 8s sits at the fast end of the 8-10s the
  // acceptance criteria allow. The provider-wide staleTime of 30s
  // (app/providers.tsx:12) is overridden here: without it the first mount
  // after a navigation serves a cached thread and looks frozen until the
  // first interval fires.
  refetchInterval: 8_000,
  staleTime: 0,
})
```

- **This is polling, not push.** Say so in the comment — WebSockets are explicitly out of scope, and the next person to read this file will wonder.
- The interval stops on unmount for free; TanStack Query owns the timer. **Do not add a `setInterval`, and do not set `refetchIntervalInBackground`** — a background tab hammering the endpoint is the failure mode the default already prevents.
- Each comment renders the author name, a role `Badge` (`"Agent"` for AGENT/ADMIN, `"Customer"` for CUSTOMER), a timestamp via `new Date(createdAt).toLocaleString()`, and the body with `whitespace-pre-wrap`.
- A `Textarea` plus a `"Post comment"` button below. `useMutation(postComment)`; `onSuccess` clears the box and invalidates `ticketKeys.comments(ticketId)`. Disable the button while `isPending` or the trimmed body is empty.
- Validate with `createCommentSchema.safeParse` before mutating, matching `customer-form.tsx:52–56`, so an empty body never reaches the network.

---

### 18 — `app/agent/tickets/[id]/page.tsx`

**Create file: `app/agent/tickets/[id]/page.tsx`**

```tsx
import { TicketDetail } from "@/components/agent/tickets/ticket-detail"

export default async function TicketDetailPage(props: PageProps<"/agent/tickets/[id]">) {
  const { id } = await props.params
  return <TicketDetail ticketId={id} />
}
```

Byte-for-byte the shape of `app/agent/customers/[id]/page.tsx`. `PageProps` is a **generated global** — do not import it.

---

### 19 — `components/agent/tickets/ticket-form.tsx` and `app/agent/tickets/new/page.tsx`

**Create file: `components/agent/tickets/ticket-form.tsx`** — `"use client"`, copying `components/agent/customers/customer-form.tsx` end to end.

- Fields: Subject (`Input`), Description (`Textarea rows={6}`), Category (`Input`), Priority (`Select`, default `"MEDIUM"`), Customer (`Select` fed by `fetchCustomers()` from `lib/customers.ts` — **reuse it, do not add a customer endpoint**), Due date (`Input type="datetime-local"`, optional), and an **"Assign to me"** checkbox.
- **The `datetime-local` value is not ISO.** It is `"2026-08-30T14:30"`, with no seconds and no timezone. Convert with `new Date(value).toISOString()` before it reaches `createTicketSchema`, whose `dueAt` is `z.iso.datetime()`. Sending the raw value produces a validation error the user cannot understand.
- Leaving Due date empty must send **no `dueAt` key at all** — not `""`, not `null` — so the server applies `defaultDueAt(priority)` from task 3.
- `safeParse` client-side → `setFieldErrors(z.flattenError(...).fieldErrors)` → `mutate`. On success `router.push(\`/agent/tickets/${ticket.id}\`)` and invalidate `ticketKeys.all`, matching `customer-form.tsx:34–37`.
- Handle the empty-customer case explicitly: when `fetchCustomers()` returns `[]`, disable submit and render `"Create a customer first."` with a link to `/agent/customers/new`. A ticket cannot exist without a customer.

**Create file: `app/agent/tickets/new/page.tsx`** — the `Card` shell from `app/agent/customers/new/page.tsx`, title `"New ticket"`, description `"Raise a ticket for an existing customer."`, widened to `max-w-2xl`.

---

### 20 — Portal pages

**Create file: `app/portal/tickets/page.tsx`** — server component. `h1` `"My tickets"`, a `Button asChild` linking to `/portal/tickets/new`, then `<PortalTicketList />`.

**Create file: `components/portal/tickets/portal-ticket-list.tsx`** — `"use client"`. `useQuery(ticketKeys.list(), fetchTickets)` against the **same** `GET /api/tickets`; the server scopes it. Columns: Subject (a link to `/portal/tickets/${id}`), Status, Priority, Created. **No assignee column and no Claim button** — a customer has no business seeing which agent holds their ticket. Empty state: `"You have no tickets yet."`, which is also exactly what an unlinked (`orphan`) account sees.

**Create file: `app/portal/tickets/new/page.tsx`** and **`components/portal/tickets/portal-ticket-form.tsx`** — Subject, Description, Category, Priority only. Validates with `createPortalTicketSchema` and submits through `createPortalTicket`. **No customer picker and no due-date field.**

**Create file: `app/portal/tickets/[id]/page.tsx`** and **`components/portal/tickets/portal-ticket-detail.tsx`** — a read-only info panel (subject, status, priority, category, created) plus `<CommentThread ticketId={id} />` from task 17. **No status control, no priority control, no assignment control, and no SLA badge** — the SLA is an internal commitment, not a customer-facing promise in this story.

---

### 21 — Navigation

**File: `components/agent/sidebar-nav.tsx`** — add `{ href: "/agent/tickets", label: "Tickets" }` to `BASE_LINKS` (lines 9–12), **between** Dashboard and Customers. The `startsWith` active check at lines 23–24 handles the detail routes with no further change.

**File: `components/portal/top-nav.tsx`** — add a `Link` to `/portal/tickets` labelled `"My tickets"` in the header row (after line 10). It is a server component with no `usePathname`; **do not** convert it to a client component just to add an active state.

---

## Edge Cases & Failure Modes

- **A CUSTOMER login with no linked `Customer` row.** `resolveViewer()` (`lib/ticket-access.ts`) returns `{ kind: "orphan" }`; `ticketScopeWhere` yields `{ customerId: "__none__" }`, so the list is `[]` with a `200`. Detail and comment routes return `notFound("Ticket not found.")`. `POST /api/tickets` returns `403 "No customer profile is linked to this account."` **Never a 500, and never an email fallback.** Reproduce it by clearing `Customer.userId` for a seeded customer.
- **A customer requesting another customer's ticket id.** The scope lives inside the `findFirst` `where`, so the row is never loaded. The response is identical to a nonexistent id — **no existence oracle**, and no chance of an ownership `if` being added later and forgotten.
- **`assignedAgentId: null` in a PATCH body.** A **release**, not "field omitted". Detected with `"assignedAgentId" in parsed.data`. `if (parsed.data.assignedAgentId)` silently drops every release and is the single most likely bug in task 7.
- **A non-admin agent claiming an already-assigned ticket.** `authorizeAssignmentChange("agentX", "agentY", { role: "AGENT" })` returns `403 "This ticket is already assigned. Only an admin can reassign it."` The UI hides the control (task 16), but the server is the boundary.
- **A non-admin releasing someone else's ticket.** `403 "Only the current assignee or an admin can release this ticket."`
- **An admin assigning a ticket to a CUSTOMER's user id.** Passes `authorizeAssignmentChange` (admins pass everything), then fails the `isStaff(target.role)` lookup in task 7 → `400` with `fieldErrors.assignedAgentId`. **Both checks are required**; the authorisation function deliberately knows nothing about the database.
- **An admin assigning to a user id that does not exist.** Same `400` branch — `findUnique` returns `null`.
- **Two agents claiming the same ticket at once.** Both read `assignedAgentId: null`, both pass the gate, the second `update` wins. **Accepted:** the loser sees the winner's name on the next refetch and no data is corrupted. A conditional write (`updateMany({ where: { id, assignedAgentId: null } })` plus a `count === 0` check) is the fix if this ever matters; it is not required by the acceptance criteria and is **not** built here.
- **Reopening a ticket that is not closed.** `POST /api/tickets/[id]/reopen` returns `409 "This ticket is not closed."`
- **`PATCH`ing a `CLOSED` ticket's status.** `409` with the reopen message. `CLOSED → CLOSED` is a no-op and allowed; changing `priority` or `category` on a closed ticket is allowed. Only the status transition is gated.
- **Route collision: `/api/tickets/assign-sweep` vs `/api/tickets/[id]`.** Next.js resolves static segments before dynamic ones, so `POST /api/tickets/assign-sweep` reaches task 10 and never task 7 with `id = "assign-sweep"`. **Verify this with the `curl` in Test Plan item 9** rather than assuming it — if it ever regressed, the symptom would be a confusing `404 "Ticket not found."` from a `requireAdmin`-guarded route.
- **The sweep with no AGENT accounts.** `200 { swept: 0, assignments: [], reason: "No agents available." }`. An admin-only deployment is a valid state, not an error.
- **The sweep with every agent at zero open tickets.** `groupBy` returns **no rows at all** for them. The load map is seeded from the agent list at `0` first, so they are all candidates. Seeding from the `groupBy` result instead makes the sweep assign nothing.
- **The sweep running twice in a row.** The second run finds no unassigned tickets and reports `swept: 0`. Idempotent by construction — the eligibility filter is `assignedAgentId: null`.
- **Tickets with `dueAt: null` during a sweep.** Excluded by the Prisma `where` **and** by `isSlaHalfElapsed` returning `false`. Two layers on purpose: the query is the fast path, the function is the correctness guarantee.
- **`dueAt` earlier than `createdAt`.** Only reachable by hand-editing or by an agent back-dating the form. `isSlaHalfElapsed` returns `true` (the window is already gone) and `isSlaBreached` returns `true`. Deliberate: an impossible deadline should look urgent, not be silently ignored.
- **Client clock skew and the SLA badge.** `slaBreached` is computed **server-side** on every read and sent in the payload. Task 14 must render the flag it receives; recomputing with `Date.now()` in the browser makes the badge depend on the viewer's clock.
- **A `datetime-local` value reaching `z.iso.datetime()`.** `"2026-08-30T14:30"` has no seconds and no offset and **fails** validation. Task 19 converts with `new Date(value).toISOString()`. Symptom if missed: "Enter a valid date and time." on a date the user clearly picked correctly.
- **A comment poll on a ticket the viewer just lost access to.** Not reachable today (nothing changes a ticket's `customerId`), but the `GET` comments handler re-checks scope on every poll rather than trusting the initial page load. Cheap insurance.
- **A comment poll in a background tab.** `refetchIntervalInBackground` is left at its default `false`, so a pinned tab does not poll all night. **Do not set it to `true`.**
- **The comment `Textarea` losing a draft on a poll.** The poll refreshes the query cache; the textarea is separate `useState`. Confirm by typing a long comment and waiting 10 s — the text must survive. If it does not, the component is deriving input state from query data and needs restructuring.
- **`prisma/seed.ts` run twice.** Task 11's `findFirst` guard means no duplicate ticket. Matches the idempotence Story 04 established for this file.
- **Deleting a customer who has tickets.** `onDelete: Restrict` gives a Prisma `P2003`. There is no delete-customer endpoint today, so this is a schema-level guarantee waiting for a caller. **Do not "fix" it to `Cascade`.**
- **`GET /api/tickets` leaking `customer.notes`.** The list `select` names its fields explicitly and does not include `notes`. A lazy `include: { customer: true }` sends an agent's private notes to the customer's own browser. Grep the finished routes for `customer: true` before committing.
- **A `403` from the assignment gate rendering as a generic failure.** `lib/api/client.ts:25–29` puts the server's `error` string on `ApiError.message`, so task 16's alert paragraph shows the real reason. Do not replace it with a hardcoded "Could not update ticket."

---

## Test Plan

No test runner is installed (`package.json` has no `test` script). These are **manual** checks; items 4–13 convert directly into integration tests once a runner exists, which is why `authorizeAssignmentChange` and the `lib/sla.ts` helpers were written as pure functions.

1. **Migration applies** — `npx prisma migrate dev --name add_ticket_and_comment`, then `npx prisma studio`: `Ticket` and `Comment` tables exist with the four indexes from task 2; `Customer` and `User` are structurally unchanged.
2. **Seed is idempotent** — `npm run seed`, twice. Both succeed; `Ticket` holds exactly **one** row, owned by the `customer@crm.local` profile, with `assignedAgentId = NULL`.
3. **Unassigned queue** — as `agent@crm.local`, `/agent/tickets` shows the seeded ticket with `"Unassigned"` and a **Claim** button. The `assigned=none` filter keeps it; `assigned=me` hides it.
4. **Claim** — click Claim. The row shows `Ava Agent` and the Claim button is gone. In the DB, `assignedAgentId` is Ava's id.
5. **Non-admin cannot steal** — sign in as a **second** AGENT (create one at `/agent/admin/users/new` as admin first). Open the ticket Ava holds: the detail page shows `"Assigned to Ava Agent"` with **no** claim, release, or reassign controls.
6. **Release** — back as `agent@crm.local`, click **Release ticket**. The ticket returns to the queue.
7. **Admin reassign** — as `admin@crm.local`, open the ticket, pick the second agent in the reassign `Select`, confirm. The assignee changes. Confirm that same `Select` is **absent** for both agents in step 5.
8. **Reopen guard** — set the ticket to `CLOSED`. The status `Select` becomes disabled and a **Reopen ticket** button appears; click it and the status returns to `OPEN`.
9. **API with `curl`** against a running dev server (get a session cookie by signing in through the browser and copying `next-auth.session-token`, or drive these from the browser console with `fetch`, which sends the cookie automatically):
   - `GET /api/tickets` with **no cookie** → `401 {"error":"Unauthorized"}`.
   - `PATCH /api/tickets/<id>` as **AGENT B** with `{"assignedAgentId":"<agentA-id>"}` → **`403`** `"Only an admin can assign a ticket to another agent."`
   - `PATCH /api/tickets/<id>` as **AGENT B** with `{"assignedAgentId":null}` while A holds it → **`403`** `"Only the current assignee or an admin can release this ticket."`
   - `PATCH /api/tickets/<id>` as **ADMIN** with the same body → **`200`**.
   - `PATCH /api/tickets/<id>` as **ADMIN** with `{"assignedAgentId":"<a CUSTOMER user id>"}` → **`400`** with `fieldErrors.assignedAgentId`.
   - `PATCH /api/tickets/<id>` as AGENT with `{}` → `400 "Provide at least one field to update."`
   - `PATCH` a `CLOSED` ticket with `{"status":"OPEN"}` → **`409`** with the reopen message.
   - `POST /api/tickets/assign-sweep` as **AGENT** → **`403`**; as **ADMIN** → `200`. **This also proves the static route wins over `/api/tickets/[id]`** — a `404 "Ticket not found."` here means the collision regressed.
   - `POST /api/tickets` as an AGENT with `assignedAgentId` in the body and no `assignToMe` → `201`, and the created ticket is **unassigned**. Assignment must not be settable through the create body.
   - `curl -d 'not-json'` at any of these → `400 {"error":"Request body must be valid JSON."}`
   - **Grep every response body for `passwordHash` and for `notes`. Neither may appear.**
10. **SLA breach is computed** — hand-edit the seeded ticket's `dueAt` to yesterday (`npx prisma studio`). Reload `/agent/tickets`: the destructive **"SLA breached"** badge appears. Set the status to `RESOLVED`: the badge disappears **without** `dueAt` changing. That proves the flag is computed, not stored.
11. **Assignment sweep** — create three unassigned `HIGH` tickets (4 h window), hand-edit their `createdAt` back 3 hours so each is past half-elapsed, and ensure two AGENT accounts exist with unequal open-ticket counts. As `admin@crm.local`, click **Run assignment sweep**: it reports `"Assigned 3 ticket(s)."` and the three land on the **less loaded** agent first, evening the two out. Click again → `"Assigned 0 ticket(s)."` Confirm a ticket with `dueAt = NULL` is **never** swept.
12. **Comment thread polls** — open the same ticket in two browsers (agent and `customer@crm.local`). Post from one; it appears in the other **within ~8 s with no reload**. Watch the network tab: one `GET …/comments` roughly every 8 s, and **none** while the tab is backgrounded.
13. **Draft survives a poll** — type a long comment, wait 15 s (at least one refetch), then post. The text must be intact.
14. **Customer scoping** — as `customer@crm.local`, `/portal/tickets` lists **only** the seeded ticket. Navigate directly to `/portal/tickets/<a ticket belonging to another customer>` → "Ticket not found." Create that other customer's ticket as an agent first, so this has something to fail against.
15. **Orphan customer** — in `prisma studio`, clear `Customer.userId` for `customer@crm.local`. Reload `/portal/tickets` → **empty list, no error, HTTP `200`**. `POST /api/tickets` from that session → `403` with the "No customer profile" message. **Restore the link afterwards.**
16. **Portal submit** — as a customer, submit a ticket from `/portal/tickets/new`. It appears in the agent queue as **unassigned**, with a `dueAt` derived from the chosen priority (`HIGH` gives roughly 4 h out).
17. **Portal has no agent controls** — on `/portal/tickets/<id>`, confirm there is **no** status control, no priority control, no assignment control, no SLA badge, and no assignee name anywhere in the rendered HTML (view source; do not just look at the page).
18. **Agent creation with self-assign** — `/agent/tickets/new` with **Assign to me** ticked creates an already-assigned ticket. Unticked creates an unassigned one.
19. **Due date round-trip** — pick a due date in the `datetime-local` field; the stored `dueAt` must match the wall-clock time you picked. A value off by the UTC offset means the `toISOString()` conversion in task 19 is missing or doubled.
20. **Regression — Stories 02/03/04** — `/agent/customers` still lists and creates; `/agent/admin/users` still lists and creates; `/register` still creates a linked customer; `/login` still routes each role to its home. No schema field those stories own changed.

---

## Migration / Rollback

- **Back up first:** `cp prisma/dev.db prisma/dev.db.bak` before `migrate dev`. Note that `prisma/dev.db.bak` is **already present and untracked** from Story 04 — overwriting it loses that snapshot. Copy it to `dev.db.story04.bak` first if you want to keep it.
- **Half-applied — schema without migration.** `prisma generate` yields a client with `prisma.ticket`, and every query fails at runtime with "no such table: Ticket". Tasks 1 and 2 land together, always.
- **Half-applied — migration without `lib/sla.ts`.** `dueAt` stays `NULL` on every ticket, no ticket ever breaches, and the sweep silently assigns nothing while returning `200`. **This failure is invisible** — it looks like a working feature with an empty backlog. Test Plan item 11's explicit `createdAt` back-dating is what catches it.
- **Half-applied — routes without `lib/ticket-access.ts`.** If a handler is written with `requireAgent()` alone and the customer scope is added "later", the portal returns every ticket in the database to every customer. **The scope belongs in the first version of each handler**, inside the `where`, not bolted on.
- **Rollback.** Revert the code, then either restore `prisma/dev.db.bak` or run `npx prisma migrate resolve --rolled-back add_ticket_and_comment` followed by a new migration dropping both tables. `Customer` and `User` rows are untouched by this story's migration, so Stories 01–04 keep working with no data loss whatsoever.
- **`components/ui/select.tsx` and `components/ui/badge.tsx` are independently revertible** — nothing outside this story imports them.

---

## Verification Steps

1. **Migration applies:** `npx prisma migrate dev --name add_ticket_and_comment` in the repo root. Read the generated SQL (Test Plan item 1) before committing.
2. **Seed applies:** `npm run seed` in the repo root, twice. Both runs succeed and `Ticket` holds exactly one row.
3. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors. This is also what catches a wrong `RouteContext<"/api/tickets/[id]">` literal — the generated types are path-exact.
4. **Lint passes:** `npm run lint` in the repo root. Zero errors.
5. **Frontend runs:** `npm run dev`, then walk Test Plan items 3–8 and 10–19 at `http://localhost:3000`.
6. **Authorization:** Test Plan item 9's request matrix. The two `403`s and the `assign-sweep` routing check are the ones that must not be skipped.
7. **Regression:** Test Plan item 20. Nothing in the Story 01–04 surface may change behaviour.
8. **Production build:** `npm run build`. It must succeed — `lib/sla.ts` is imported from both server handlers and client components, so a stray `@/lib/prisma` import there fails here rather than in `dev`.

---

## Done Criteria

- [ ] `Ticket` and `Comment` models exist in `prisma/schema.prisma` with `priority` and `status` as **Strings, not Prisma enums**, `assignedAgentId` **nullable**, and `Customer.tickets` replacing the `TODO(Story 03)` comment; a committed migration under `prisma/migrations/` creates both tables and all four indexes.
- [ ] `app/api/tickets/route.ts` (`GET` + `POST`), `app/api/tickets/[id]/route.ts` (`GET` + `PATCH` + `DELETE`), `app/api/tickets/[id]/comments/route.ts` (`GET` + `POST`), `app/api/tickets/[id]/reopen/route.ts` (`POST`), and `app/api/tickets/assign-sweep/route.ts` (`POST`) all exist and all guard themselves — `middleware.ts` does not cover `/api/**`.
- [ ] `GET /api/tickets/[id]` returns the ticket **plus** customer, assigned agent, and comments in one response.
- [ ] Every new ticket is created with `assignedAgentId = null`, except when an agent ticks **"assign to me"**; an `assignedAgentId` sent in a create body is ignored.
- [ ] Assignment authorisation is **field-level** in `lib/ticket-access.ts`'s `authorizeAssignmentChange`, applied on `PATCH`: claiming `null → self` is open to AGENT and ADMIN; releasing needs the assignee or an ADMIN; assigning to a **different** named agent returns **`403`** for a non-admin.
- [ ] `POST /api/tickets/assign-sweep` is `requireAdmin()`-guarded, assigns every unassigned ticket whose SLA window is **more than half elapsed** to the AGENT with the fewest open tickets, updates its running load count between assignments, and returns `200` with `swept: 0` when there are no agents.
- [ ] The comment thread refetches on an **8 s** `refetchInterval` while the page is open, with no `setInterval` and no `refetchIntervalInBackground`.
- [ ] A `CLOSED` ticket's status cannot be changed by `PATCH` (`409`); `POST /api/tickets/[id]/reopen` is the only way back to `OPEN`.
- [ ] `slaBreached` is **computed at read time** by `lib/sla.ts` on every ticket response — `grep -n slaBreached prisma/schema.prisma` returns nothing.
- [ ] A CUSTOMER sees and can comment on only the tickets whose `customerId` matches the `Customer` found by `userId === session.user.id`; the scope sits inside the Prisma `where`, and **no code anywhere matches a ticket to a login by email**.
- [ ] A CUSTOMER login with no linked `Customer` row gets an **empty list and a `200`** — never an error, never another customer's data.
- [ ] `prisma/seed.ts` creates exactly one demo ticket against the `Customer` already linked to `customer@crm.local`, with no new email-matching logic, and stays idempotent across repeated runs.
- [ ] `app/agent/tickets` lists tickets with status / priority / "assigned to me" filters, a **Claim** action on unassigned rows, and an admin-only **Run assignment sweep** button.
- [ ] `app/agent/tickets/[id]` shows the info panel, status and priority controls, claim / release / reassign controls (reassign-to-another-agent rendered **only** for admins), the SLA-breach indicator, and the live comment thread.
- [ ] `app/agent/tickets/new` creates a ticket against an existing customer with an optional **"assign to me"** checkbox.
- [ ] `app/portal/tickets` lets a customer submit, list, open, and comment on their own tickets, with no assignee, no SLA badge, and no agent controls anywhere in the markup.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 06.**
