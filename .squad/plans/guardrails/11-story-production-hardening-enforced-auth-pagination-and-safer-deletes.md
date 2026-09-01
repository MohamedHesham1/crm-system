# Story 11 — Production hardening: enforced auth, pagination, and safer deletes

## Prerequisites

- **Stories 01–10 completed and committed.** This story changes how four existing behaviours are declared and enforced; it ships no new user-facing feature.
  - Story 01 ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)) — `auth.ts`, `auth.config.ts`, `middleware.ts`, `lib/prisma.ts`, `lib/roles.ts`.
  - Story 02 ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md)) — `app/api/customers/route.ts`, `lib/customers.ts`, `components/agent/customers/customer-table.tsx`.
  - Story 03 ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md)) — `lib/api/http.ts`, which this story extends rather than replaces.
  - Story 04 ([`../registration/04-story-customer-self-registration-with-automatic-account-linking.md`](../registration/04-story-customer-self-registration-with-automatic-account-linking.md)) — `app/api/register/route.ts`, `lib/registration.ts`.
  - Story 05 ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md)) — the ticket routes, `lib/ticket-access.ts`, `lib/ticket-select.ts`, `lib/sla.ts`.
  - Story 06 ([`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md)) — `lib/activity.ts`, and `AuditLog`, which deliberately has **no foreign key on `entityId`** — the reason the hard delete is a problem.
  - Story 08 ([`../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md`](../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md)) — `Ticket.resolvedAt`, whose migration is the exact template for `Ticket.deletedAt`.
- **Story 09 ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md)) is the regression baseline.** All **20 existing tests must still pass with their assertions unmodified**. Two of them constrain the design directly:
  - `tests/api/customers.test.ts:27` calls the exported handler as **`await GET()`** — with **no arguments**. Any wrapper placed on that export must tolerate `request === undefined` (task 2).
  - `tests/api/customers.test.ts:30` reads `listed.customers`, so the paginated response must **keep the existing array under its existing key** and only add fields beside it (task 4).
- **`tests/setup/api.ts` is a setup file, not a test.** Adding one line to its `beforeEach` (task 3) does not violate "story 09's tests pass unchanged".
- **Versions are pinned and must not move.** `next@16.3.3`, `react@19.2.8`, `prisma` / `@prisma/client@6.19.3`, `next-auth@^5.0.0-beta.32`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`. **This story installs nothing.** No Redis, no `rate-limiter-flexible`, no `lru-cache`.

---

## Story Goal

Close four gaps found in a post-implementation review of an otherwise finished application. Nothing here is a feature; every change either makes an existing rule structurally enforced or removes a way for existing data to go wrong.

1. **Authorisation becomes declared, not remembered.** A new `withAuth(options, handler)` in `lib/api/http.ts` wraps every route handler under `app/api/**`. A handler cannot be exported without naming a role, so a forgotten guard is a compile error rather than an open endpoint. `requireAgent()`, `requireAdmin()` and `requireUser()` **keep their current signatures and their current logic** and become what the wrapper calls; `resolveViewer()` likewise. **No route's authorization outcome changes.**
2. **`GET /api/tickets` and `GET /api/customers` paginate.** Offset-based `page` / `pageSize` (default **25**, max **100**), applied with Prisma `skip` / `take`, with `{ total, page, pageSize }` added beside the existing array. `TicketTable`, `PortalTicketList` and `CustomerTable` page through instead of fetching every row.
3. **The two unauthenticated entry points are throttled.** `POST /api/register` and the credentials `authorize()` in `auth.ts` get a per-IP, in-memory, sliding-window attempt limit. Over the limit, the register route answers **429** with a `Retry-After` header, before any database work.
4. **Deleting a ticket stops destroying history.** `Ticket.deletedAt` (nullable, indexed) is added; `DELETE /api/tickets/[id]` sets it instead of removing the row; every ticket read excludes soft-deleted rows. `AuditLog.entityId` for a `TICKET_DELETED` row now points at a row that still exists.

**Not in scope:** server-side prefetch/hydration for the dashboard and ticket-list pages; a Redis or otherwise distributed limiter; soft delete on any model other than `Ticket`; cursor-based pagination; pagination for `/api/admin/audit`, `/api/notifications` or `/api/dashboard` (all three already cap with a fixed `take`); any change to the three-role permission model; an undelete/restore UI.

---

## Context — Read These Files First

1. `lib/api/http.ts` — all 61 lines. **Lines 6–9**: the comment stating that `middleware.ts` excludes `/api/**`, so every handler guards itself — this is the gap `withAuth` closes structurally. `requireAgent()` **11–16**, `requireAdmin()` **19–24**, `requireUser()` **32–40** (the only one that returns identity, as `{ ok: true; user: { id, role } }`). `validationError` **42–45**, `notFound` **47–49**, `readJson` **52–60**. **Do not change the bodies of the three guards.**
2. `lib/ticket-access.ts` — all 104 lines. `Viewer` **5–16** (`staff` | `customer` | `orphan`). `resolveViewer()` **28–53** — the same `{ ok } | { response }` shape as `requireUser`; note the `name` coalescing at **41**. **`ticketScopeWhere()` 60–64** — the single function task 6 extends with `deletedAt: null`; note it returns `{}` for staff, which is why staff currently see everything. `authorizeAssignmentChange` **82–104** — untouched by this story.
3. `app/api/tickets/route.ts` — all 120 lines. `GET` **16–45**: `resolveViewer()` at 17, filter parsing 21–34, the unbounded `findMany` at **36–40**, the response at 42–44. `POST` **47–119**, whose `$transaction` at 100–117 is the pattern the soft delete follows.
4. `app/api/customers/route.ts` — all 48 lines. `GET` **7–17**: `requireAgent()` at 8–9 and the unbounded `findMany` at 11–14, selecting exactly five fields. `POST` **19–47**: 201 on success, **409** on `P2002` (37–45).
5. `app/api/tickets/[id]/route.ts` — all 196 lines. `GET` **13–27** (scoped `findFirst` at 20–23). `PATCH` **29–161** — note the `findUnique` at **50–60**, which task 6 converts to a `findFirst`, and the `$transaction` at 136–152. **`DELETE` 163–196** — `requireAdmin()` at 164, the `findUnique` at **169**, the second `auth()` call at **172–174** (which `withAuth` removes), and `tx.ticket.delete()` at **178** inside a transaction that already writes a `TICKET_DELETED` audit row at 179–187. **The audit row already exists**; what is missing is a surviving target for its `entityId`.
6. `app/api/tickets/[id]/reopen/route.ts` — `resolveViewer()` at 10, the staff check at 14–16, the `findUnique` at **20–23** (task 6 converts it), the `$transaction` from 30 onward.
7. `app/api/tickets/[id]/comments/route.ts` — all 78 lines. **`loadScopedTicket` 15–26** calls `resolveViewer()` itself and is shared by both verbs; task 2 changes it to take a `Viewer` parameter instead. The `findFirst` at **19–22** already spreads `ticketScopeWhere`, so it inherits the soft-delete filter for free.
8. `app/api/tickets/[id]/feedback/route.ts` — all 70 lines. `resolveViewer()` at 13, the `viewer.kind !== "customer"` 403 at **21–23**, and a `findFirst` at **30–33** that builds its own `where` (`{ id, customerId }`) instead of using `ticketScopeWhere` — **it needs `deletedAt: null` added by hand**.
9. `app/api/tickets/assign-sweep/route.ts` — all 104 lines. `requireAdmin()` at 12, `findMany` at **15–18**, `groupBy` at **31–35**, the subject lookup `findMany` at **64–67**, and the second `auth()` call at **58–60** that `withAuth` removes. All three queries need `deletedAt: null`.
10. `app/api/dashboard/route.ts` — all 70 lines. `requireUser()` at 16, the explicit `isStaff` 403 at **25** with the comment at 20–25 explaining why this route is `requireUser` and not `requireAgent`, and the five-query `Promise.all` at **33–49** — one `groupBy`, three `count`s and one `findMany`, every one of which needs `deletedAt: null`.
11. `app/api/reports/route.ts` — `GET` from **30**; `requireUser()` at 31, the `isStaff` 403 at **38**, and the `Promise.all` at **40–49** whose first three entries are ticket queries (41, 42, 43).
12. `app/api/reports/agents/route.ts` — `requireAdmin()` at **9–10** and the ticket `findMany` at **13–16**.
13. `app/api/admin/audit/route.ts` (29 lines), `app/api/admin/users/route.ts`, `app/api/customers/[id]/route.ts` (59 lines), `app/api/notifications/route.ts` (30 lines), `app/api/notifications/[id]/route.ts` (29 lines) — the remaining routes to migrate. `AUDIT_PAGE_SIZE = 100` (`admin/audit/route.ts:5`) and `NOTIFICATION_PAGE_SIZE = 20` (`notifications/route.ts:5`) already cap their reads and are **out of scope for pagination**.
14. `app/api/auth/[...nextauth]/route.ts` — all 3 lines: `export const { GET, POST } = handlers`. **This is the one route that is not migrated** — the handlers are Auth.js's, not this codebase's. Task 2 records the exemption in a comment.
15. `auth.ts` — all 39 lines. `authorize(raw)` at **22–37**: `loginSchema.safeParse` (23), `prisma.user.findUnique` (**27**), `verifyPassword` (**30**). The throttle goes **before line 27**. `node_modules/@auth/core/providers/credentials.d.ts:45` documents the second parameter — `async authorize(credentials, request)` — which is how the handler gets headers. `node_modules/next-auth/index.d.ts:76` exports `CredentialsSignin`.
16. `app/(auth)/login/actions.ts` — all 37 lines. `signIn("credentials", …)` at 24–28 inside a `try`, with `error instanceof AuthError` at **30–32** collapsing everything to `"Invalid email or password."` Task 3 adds a **more specific branch above it**; `CredentialsSignin` extends `AuthError`, so the order is load-bearing.
17. `middleware.ts` — all 38 lines. The matcher at **37** excludes `/api`. **Do not change it.** Rate limiting the credentials callback from middleware would need a Node-runtime middleware and a second copy of the in-memory store; see `## Edge Cases & Failure Modes`.
18. `prisma/schema.prisma` — `model Ticket` **59–104**: `resolvedAt` at **91** with its doc comment, and the index block at **99–103** (`status`, `assignedAgentId`, `customerId`, `resolvedAt`). `deletedAt` is added next to `resolvedAt` and gains a fifth index.
19. `prisma/migrations/20260830012607_add_feedback_and_ticket_resolved_at/migration.sql` — the shape to copy: one `ALTER TABLE "Ticket" ADD COLUMN`, then `CREATE INDEX "Ticket_resolvedAt_idx"`. **`Ticket.deletedAt` needs no backfill** — `NULL` is exactly "not deleted".
20. `lib/tickets.ts` — 136 lines. `TicketListItem` **21–32**, `ticketKeys` **62–67**, `buildQuery` **69–76**, `fetchTickets` **78–83**. Task 4 changes the last three.
21. `lib/customers.ts` — all 55 lines. `CustomerListItem` 7–13, `customerKeys` 25–29, `fetchCustomers` **31–34**.
22. `lib/api/client.ts` — all 33 lines. `request<T>()` throws `ApiError` on any non-2xx, carrying `status` — which is what makes a 429 surface as a readable message in the register form with no extra client work.
23. `components/agent/tickets/ticket-table.tsx` — all 218 lines. `useState<TicketFilters>` at **28**, the query at **31–34**, the three `setFilters` calls in the `Select` handlers at **61–63**, **80–82** and **99–101**, "Clear filters" at **114**, and the render branches keyed on `data.length` at **145**, **149** and `data.map` at **162**. Task 5 rewrites those to read `data.items`.
24. `components/agent/customers/customer-table.tsx` — all 53 lines (`data.length` at 25, `data.map` at 39) — and `components/portal/tickets/portal-ticket-list.tsx` (`data.length` at 26, `data.map` at 41). Same shape, same edit.
25. `tests/setup/api.ts` — all 14 lines: `beforeEach` calls `signInAs(null)` then `resetDb()`. One line joins them in task 3.
26. `tests/helpers/request.ts` — 13 lines. `jsonRequest(url, method, body)` and `routeContext(params)` (`params` is a **Promise**). New tests use both.
27. `tests/helpers/factories.ts` — 59 lines. `createUser(role)`, `createCustomer()`, `createTicket({ customerId, status?, priority?, assignedAgentId?, createdAt?, dueAt? })`. **No factory change is needed** — `deletedAt` defaults to `NULL`.
28. `tests/api/customers.test.ts` (49 lines) and `tests/api/register.test.ts` (60 lines) — the two files whose behaviour the new code most easily breaks. Read both before writing task 2 or task 3.
29. Grep for `prisma\.ticket\.` and `tx\.ticket\.` across `app/` and `lib/`: **24 hits across 9 files**. Task 6 must account for every one of them; the full list is in that task's table.
30. Grep for `requireAgent|requireAdmin|requireUser|resolveViewer` across `app/`: **42 hits across 17 files** (a few are comments). By the end of task 2 the only hits under `app/` must be inside comments, and `lib/api/http.ts` plus `lib/ticket-access.ts` must be the only modules that define or call them.

---

## Product rules (from story)

| Behaviour | Today | After this story |
|---|---|---|
| A route handler with no guard | Compiles, deploys, serves everyone | Cannot be written — the export is `withAuth(...)`, and the options object requires a `role` |
| `GET /api/tickets` with 5 000 tickets | Returns all 5 000 | Returns 25, plus `total`, `page`, `pageSize` |
| 500 registration attempts from one IP in a minute | 500 bcrypt hashes and 1 000 queries | The first few run; the rest get **429** before any query |
| 500 login attempts from one IP | 500 `findUnique` + `verifyPassword` pairs | The first few run; the rest are rejected before the query |
| `DELETE /api/tickets/[id]` | Row removed; the `TICKET_DELETED` audit row's `entityId` dangles | Row kept with `deletedAt` set; the audit row resolves; the ticket disappears from every list, detail, count and report |
| A deleted ticket in `GET /api/reports` | Counted until it was deleted, then silently gone along with its row | Excluded from the moment it is deleted, with the row still on disk |

---

## Backend Tasks

### 1 — `lib/rate-limit.ts`: the in-memory limiter

**Create file: `lib/rate-limit.ts`**

```ts
/**
 * A sliding-window attempt counter held in **process memory**. Deliberately not
 * Redis: this application runs as a single Node process, and an eleventh story
 * on a project this size does not get to add an infrastructure dependency. Two
 * consequences are accepted, not overlooked: the counters reset on deploy, and
 * a multi-instance deployment would give each instance its own budget.
 */
export type RateLimitRule = {
  /** Attempts allowed inside `windowMs`. */
  limit: number
  windowMs: number
}

export const RATE_LIMITS = {
  /** `POST /api/register`. Generous enough that a person fixing a typo never sees it. */
  register: { limit: 5, windowMs: 10 * 60 * 1000 },
  /** The credentials `authorize()`. Only **failed** attempts are recorded. */
  login: { limit: 10, windowMs: 5 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Cap on distinct keys. Without it, a `Map` keyed by a request header is an
 * unbounded allocation an attacker controls. At the cap the oldest key is
 * dropped — the worst case is that one attacker regains a few attempts, which
 * is strictly better than the process dying.
 */
const MAX_KEYS = 5_000

const hits = new Map<string, number[]>()

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number }

/**
 * Reads the counter **without** recording an attempt. Callers that want to
 * charge the attempt call `recordAttempt` afterwards — which is what lets the
 * login path charge failures only.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): RateLimitVerdict {
  const cutoff = now - rule.windowMs
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff)

  if (recent.length === 0) hits.delete(key)
  else hits.set(key, recent)

  if (recent.length < rule.limit) return { ok: true }

  const oldest = recent[0]
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
  }
}

export function recordAttempt(key: string, now = Date.now()): void {
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    const oldestKey = hits.keys().next().value
    if (oldestKey !== undefined) hits.delete(oldestKey)
  }
  hits.set(key, [...(hits.get(key) ?? []), now])
}

/** Test seam. Called from `tests/setup/api.ts`'s `beforeEach`, never from application code. */
export function resetRateLimits(): void {
  hits.clear()
}

/**
 * There is no `request.ip` in Next 16 — a proxy header is the only source. A
 * deployment that sets neither header puts every caller in one `"unknown"`
 * bucket; see the plan's Edge Cases section.
 */
export function clientIp(request: Request | undefined): string {
  const forwarded = request?.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request?.headers.get("x-real-ip")?.trim() || "unknown"
}
```

`checkRateLimit` is **pure with respect to the budget** and `recordAttempt` is the only writer. Keeping them separate is what makes "charge failed logins only" expressible without a second rule.

### 2 — `withAuth` in `lib/api/http.ts`, and the migration of all 17 route files

**File: `lib/api/http.ts`**

Keep every existing export as it is. Add, below `requireUser()`:

```ts
export type AuthRole = "public" | "user" | "agent" | "admin" | "viewer"

/** What the wrapped handler receives as its third argument, per role. */
type AuthPayloads = {
  public: null
  user: { id: string; name: string; role: Role }
  agent: { id: string; name: string; role: Role }
  admin: { id: string; name: string; role: Role }
  viewer: Viewer
}

export type AuthOptions<R extends AuthRole> = {
  /**
   * **Required.** This is the whole point of the wrapper: a handler cannot be
   * exported without answering "who may call this?", so a forgotten guard is a
   * type error rather than an open endpoint. `"public"` is a deliberate,
   * greppable declaration — not the absence of one.
   */
  role: R
  /** Per-IP throttle, applied before the role check and before any database work. */
  rateLimit?: RateLimitRule
}

/**
 * Wraps a route handler with its authorisation declaration.
 *
 * This adds **no new authorisation logic**. `requireAgent()`, `requireAdmin()`,
 * `requireUser()` and `resolveViewer()` keep their signatures and their bodies;
 * this decides which one to call and hands the result to the handler, so no
 * route's outcome changes. What changes is that the decision is part of the
 * export rather than the first two lines of the body.
 */
export function withAuth<R extends AuthRole, C = unknown>(
  options: AuthOptions<R>,
  handler: (request: Request, ctx: C, auth: AuthPayloads[R]) => Promise<Response>,
): (request: Request, ctx: C) => Promise<Response> {
  return async (request: Request, ctx: C): Promise<Response> => {
    // Next always passes a Request. `tests/api/customers.test.ts:27` calls the
    // export as `GET()`, so normalise here and keep the inner handler's
    // `request` non-nullable instead of weakening its type everywhere.
    const req = request ?? new Request("http://localhost/")

    if (options.rateLimit) {
      const key = `${new URL(req.url).pathname}:${clientIp(req)}`
      const verdict = checkRateLimit(key, options.rateLimit)
      if (!verdict.ok) return tooManyRequests(verdict.retryAfterSeconds)
      recordAttempt(key)
    }

    if (options.role === "public") {
      return handler(req, ctx, null as AuthPayloads[R])
    }

    if (options.role === "viewer") {
      const resolved = await resolveViewer()
      if (!resolved.ok) return resolved.response
      return handler(req, ctx, resolved.viewer as AuthPayloads[R])
    }

    if (options.role === "admin") {
      const denied = await requireAdmin()
      if (denied) return denied
    } else if (options.role === "agent") {
      const denied = await requireAgent()
      if (denied) return denied
    }

    // `requireAgent`/`requireAdmin` return Response-or-null and carry no
    // identity, so the caller is resolved once more here. That is a second
    // `auth()` call on staff routes; see the plan's Edge Cases.
    const identity = await requireUser()
    if (!identity.ok) return identity.response
    return handler(req, ctx, identity.user as AuthPayloads[R])
  }
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many attempts. Try again in a few minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  )
}
```

**Also in this file:** add `name` to `requireUser()`'s payload — `name: session.user.name ?? "Unknown user"`, exactly as `resolveViewer()` does at `lib/ticket-access.ts:41`. This is **additive**: every existing caller (`dashboard`, `reports`, both `notifications` routes) still type-checks, which is what the acceptance criterion's "keep their current signatures" protects. Two routes need `name` from the wrapper (see below), and a second `auth()` call in a handler would defeat the point of the wrapper.

New imports at the top of `lib/api/http.ts`: `Viewer` and `resolveViewer` from `@/lib/ticket-access`; `checkRateLimit`, `clientIp`, `recordAttempt` and `RateLimitRule` from `@/lib/rate-limit`. **`lib/ticket-access.ts` does not import from `lib/api/http.ts`** — verified: it imports `@/auth`, `@/lib/prisma` and `@/lib/roles` only — so this is not a cycle.

The three `as AuthPayloads[R]` casts are unavoidable: TypeScript does not narrow a mapped-type lookup from a comparison on `options.role` while `R` is still generic. They are the only casts in the file; **do not** add more by widening the handler signature.

**Migrate every route.** In each file, delete the guard's two lines from the body, wrap the handler, and take identity from the third argument instead of a second `auth()` call.

| File | Exports | `role` |
|---|---|---|
| `app/api/customers/route.ts` | `GET`, `POST` | `agent` |
| `app/api/customers/[id]/route.ts` | `GET`, `PATCH` | `agent` |
| `app/api/admin/users/route.ts` | `GET`, `POST` | `admin` |
| `app/api/admin/audit/route.ts` | `GET` | `admin` |
| `app/api/reports/agents/route.ts` | `GET` | `admin` |
| `app/api/tickets/assign-sweep/route.ts` | `POST` | `admin` |
| `app/api/tickets/[id]/route.ts` | `GET`, `PATCH` | `viewer` |
| `app/api/tickets/[id]/route.ts` | `DELETE` | `admin` |
| `app/api/tickets/route.ts` | `GET`, `POST` | `viewer` |
| `app/api/tickets/[id]/comments/route.ts` | `GET`, `POST` | `viewer` |
| `app/api/tickets/[id]/feedback/route.ts` | `POST` | `viewer` |
| `app/api/tickets/[id]/reopen/route.ts` | `POST` | `viewer` |
| `app/api/dashboard/route.ts` | `GET` | `user` |
| `app/api/reports/route.ts` | `GET` | `user` |
| `app/api/notifications/route.ts` | `GET` | `user` |
| `app/api/notifications/[id]/route.ts` | `PATCH` | `user` |
| `app/api/register/route.ts` | `POST` | `public` + `rateLimit` |
| `app/api/auth/[...nextauth]/route.ts` | `GET`, `POST` | **exempt** |

The shape of a migrated dynamic route, for reference:

```ts
export const GET = withAuth(
  { role: "viewer" },
  async (_request, ctx: RouteContext<"/api/tickets/[id]">, viewer) => {
    const { id } = await ctx.params
    // …body, minus the resolveViewer lines
  },
)
```

`C` is inferred from the handler's `ctx` annotation, so `RouteContext<"…">` still flows through to Next's generated route types (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, "Route Context Helper"). For a route with no dynamic segment, omit `ctx` entirely and `C` defaults to `unknown`.

Notes that decide specific edits:

- **`dashboard` and `reports` keep their explicit `isStaff` check** (`app/api/dashboard/route.ts:25`, `app/api/reports/route.ts:38`) inside the handler body. They are `user`, not `agent`, because the comment at `dashboard/route.ts:20–25` records a deliberate choice about which 403 they emit; `withAuth` must not quietly convert it.
- **`app/api/tickets/[id]/route.ts` DELETE loses lines 172–174.** `const session = await auth()` / `session!.user.id` / `session!.user.name` become `auth.id` and `auth.name` from the wrapper. Drop the now-unused `import { auth } from "@/auth"` at line 3.
- **`app/api/tickets/assign-sweep/route.ts` loses lines 58–60** the same way, and drops its `import { auth } from "@/auth"` at line 1.
- **`app/api/tickets/[id]/comments/route.ts`**: change `loadScopedTicket(id)` (15–26) to `loadScopedTicket(viewer: Viewer, id: string)`, delete its internal `resolveViewer()` call and its `{ ok: false }` branch for an unauthenticated caller (the wrapper now owns that), and pass the wrapper's `viewer` in from both verbs.
- **`app/api/auth/[...nextauth]/route.ts`** stays three lines. Add above the export:
  ```ts
  // The one route under `app/api/**` not wrapped in `withAuth`: these handlers
  // are Auth.js's own, and authentication is what they are for. The throttle
  // for the credentials flow lives in `authorize()` (`auth.ts`), not here.
  ```

### 3 — Throttle the two public entry points

**File: `app/api/register/route.ts`**

Replace the bare `export async function POST(request: Request)` with the wrapper and rewrite the doc comment — the "no guard, on purpose" note is now expressed in code:

```ts
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
    // …unchanged from here (current lines 14–32)
  },
)
```

**File: `auth.ts`**

```ts
import NextAuth, { CredentialsSignin } from "next-auth"
// …existing imports
import { checkRateLimit, clientIp, RATE_LIMITS, recordAttempt } from "@/lib/rate-limit"

/**
 * `authorize()` cannot set an HTTP status — Auth.js owns the response for the
 * credentials callback — so a throttled attempt surfaces as this error code
 * rather than a literal 429. `app/(auth)/login/actions.ts` turns it into the
 * "too many attempts" message. See the plan's Edge Cases for why this is not
 * done in `middleware.ts`.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate-limited"
}
```

Inside `authorize`, take the second parameter and guard **above the `findUnique` at line 27**:

```ts
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

        // …unchanged return
      },
```

**File: `app/(auth)/login/actions.ts`**

Add the specific branch **above** the existing `AuthError` branch at 30–32 — `CredentialsSignin` extends `AuthError`, so the order is load-bearing:

```ts
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate-limited") {
      return { error: "Too many sign-in attempts. Try again in a few minutes." }
    }
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." }
    }
    throw error
  }
```

Import `CredentialsSignin` alongside `AuthError` from `"next-auth"` (line 3).

**File: `tests/setup/api.ts`**

```ts
import { resetRateLimits } from "@/lib/rate-limit"
// …
beforeEach(async () => {
  signInAs(null)
  resetRateLimits()
  await resetDb()
})
```

Without this, `tests/api/register.test.ts`'s three `POST`s share one `"unknown"` bucket for the whole file, and the suite becomes order-dependent the moment a fourth registration test is added.

### 4 — Offset pagination

**Create file: `lib/api/pagination.ts`**

```ts
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type Pagination = { page: number; pageSize: number; skip: number; take: number }

/**
 * Offset pagination, not cursor: it maps onto the existing `findMany` calls
 * with a `skip`/`take` pair and nothing else. Every malformed input clamps to a
 * usable value — `?page=0`, `?page=-3`, `?pageSize=banana` and `?pageSize=9999`
 * all yield page 1 or a legal size rather than a 400, because a list endpoint
 * that 400s on a stale bookmark is worse than one that shows page 1.
 */
export function parsePagination(request: Request | undefined): Pagination {
  const params = request ? new URL(request.url).searchParams : new URLSearchParams()

  const rawPage = Number.parseInt(params.get("page") ?? "", 10)
  const rawSize = Number.parseInt(params.get("pageSize") ?? "", 10)

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(Math.max(rawSize, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}
```

**File: `app/api/tickets/route.ts`** — `GET` only. Keep the filter parsing at 21–34 untouched; replace the query and response at 36–44:

```ts
  const { page, pageSize, skip, take } = parsePagination(request)
  const where = { ...ticketScopeWhere(viewer), ...filters }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: TICKET_LIST_SELECT,
    }),
    prisma.ticket.count({ where }),
  ])

  return Response.json({
    tickets: tickets.map((ticket) => ({ ...ticket, slaBreached: isSlaBreached(ticket) })),
    total,
    page,
    pageSize,
  })
```

The `where` must be **built once and shared** by both queries; a count computed from a different `where` than the page is the classic pagination bug.

**File: `app/api/customers/route.ts`** — `GET` only, the same shape, `orderBy: { name: "asc" }`, the same five-field `select`, response key `customers`.

**File: `lib/tickets.ts`**

```ts
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned?: "me" | "none"
  /** 1-based. Omitted means page 1. Part of the filter object so it is part of the cache key. */
  page?: number
}

export async function fetchTickets(
  filters: TicketFilters = {},
): Promise<Paginated<TicketListItem>> {
  const { tickets, total, page, pageSize } = await request<{
    tickets: TicketListItem[]
    total: number
    page: number
    pageSize: number
  }>(`/api/tickets${buildQuery(filters)}`)
  return { items: tickets, total, page, pageSize }
}
```

Extend `buildQuery` (69–76) with `if (filters.page && filters.page > 1) params.set("page", String(filters.page))`. Folding `page` into `TicketFilters` keeps `ticketKeys.list(filters)` (62–67) as the whole cache key with **no signature change**, so every existing `invalidateQueries({ queryKey: ticketKeys.all })` call keeps working untouched.

**File: `lib/customers.ts`** — mirror it: import `Paginated` from `@/lib/tickets` (one definition, not two), change `customerKeys.list()` to `customerKeys.list(page = 1)`, and change `fetchCustomers(page = 1)` to append `?page=` when `page > 1` and return `Paginated<CustomerListItem>`.

## Frontend Tasks

### 5 — Page through the three lists

All three components change the same way: read `data.items` instead of `data`, hold a page, and render a two-button pager. **No new dependency and no new UI primitive** — `components/ui/button.tsx` is enough.

**File: `components/agent/tickets/ticket-table.tsx`**

- The `filters` state at **28** already carries `page` once `TicketFilters` gains it. Every existing `setFilters` call that changes a filter must **also reset `page: 1`** — a page-3 view filtered down to two results otherwise renders empty. That is the three `Select` handlers at **61–63**, **80–82**, **99–101** and "Clear filters" at **114**.
- Lines **145** and **149**: `data.length` → `data.items.length`. Line **162**: `data.map` → `data.items.map`.
- Add `placeholderData: keepPreviousData` (imported from `@tanstack/react-query`) to the `useQuery` at **31–34**. Without it, every page change unmounts the table into the "Loading tickets…" branch at 137 and the layout jumps.
- Below `</Table>`, add the pager, rendered only when `data.total > data.pageSize`:

```tsx
<div className="flex items-center justify-between">
  <p className="text-meta text-muted-foreground">
    {`Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(
      data.page * data.pageSize,
      data.total,
    )} of ${data.total}`}
  </p>
  <div className="flex gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={data.page <= 1}
      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
    >
      Previous
    </Button>
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={data.page * data.pageSize >= data.total}
      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
    >
      Next
    </Button>
  </div>
</div>
```

**File: `components/portal/tickets/portal-ticket-list.tsx`** — the same edit, with a local `useState(1)` for the page (it has no filter state today), `fetchTickets({ page })`, and the same pager. Note it must become a component with state; it currently returns early on `isPending` at line 16, so keep those early returns above the pager.

**File: `components/agent/customers/customer-table.tsx`** — the same edit against `customerKeys.list(page)` and `fetchCustomers(page)`.

### 6 — Soft delete

**File: `prisma/schema.prisma`** — in `model Ticket`, after `resolvedAt` (line 91):

```prisma
  /// **Soft delete.** `DELETE /api/tickets/[id]` sets this instead of removing
  /// the row, because `AuditLog` deliberately has no foreign key on `entityId`
  /// and a hard delete leaves every `TICKET_DELETED` entry pointing at nothing.
  /// NULL means "live"; every read path filters on it, most of them through
  /// `ticketScopeWhere()` in `lib/ticket-access.ts`.
  deletedAt       DateTime?
```

and a fifth entry in the index block at 99–103: `@@index([deletedAt])`.

Generate the migration with `npx prisma migrate dev --name add_ticket_deleted_at`. The expected SQL is two statements and **no backfill** — `NULL` already means "not deleted":

```sql
-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Ticket_deletedAt_idx" ON "Ticket"("deletedAt");
```

**File: `lib/ticket-access.ts`** — extend `ticketScopeWhere` (60–64) and export the fragment for the queries that do not go through it:

```ts
/**
 * "Not soft-deleted." Spread into every ticket query that does not already go
 * through `ticketScopeWhere`. A ticket query in this codebase with neither is a
 * bug: soft-deleted rows would reappear in a count, a report or the assignment
 * sweep while staying invisible in the list they were deleted from.
 */
export const NOT_DELETED = { deletedAt: null } as const

export function ticketScopeWhere(viewer: Viewer) {
  if (viewer.kind === "staff") return { ...NOT_DELETED }
  if (viewer.kind === "customer") return { ...NOT_DELETED, customerId: viewer.customerId }
  return { ...NOT_DELETED, customerId: "__none__" }
}
```

**File: `app/api/tickets/[id]/route.ts`** — `DELETE`. Replace the `findUnique` at 169 and the `delete` at 178:

```ts
    const existing = await prisma.ticket.findFirst({
      where: { id, ...NOT_DELETED },
      select: { subject: true },
    })
    if (!existing) return notFound("Ticket not found.")
```

```ts
      await tx.ticket.update({ where: { id }, data: { deletedAt: new Date() } })
```

The `logActivity` block at 179–187 **stays exactly as it is** — the audit row was already being written; what this change buys is that its `entityId` now resolves. Keep the `P2025` catch at 191–194: `update` throws it just as `delete` did, so a second DELETE racing the first still yields "Ticket not found."

**Every remaining ticket query.** The ones reached through `ticketScopeWhere` are already covered and are listed so the executor can confirm rather than re-derive:

| File:line | Query | Change |
|---|---|---|
| `app/api/tickets/route.ts:36` | `findMany` | covered by `ticketScopeWhere` — verify only |
| `app/api/tickets/route.ts` (new `count`, task 4) | `count` | shares the same `where` — verify only |
| `app/api/tickets/[id]/route.ts:20` | `findFirst` | covered — verify only |
| `app/api/tickets/[id]/route.ts:50` | `findUnique` | **convert to `findFirst`**, `where: { id, ...NOT_DELETED }` |
| `app/api/tickets/[id]/route.ts:169` | `findUnique` | **convert to `findFirst`** (shown above) |
| `app/api/tickets/[id]/comments/route.ts:19` | `findFirst` | covered — verify only |
| `app/api/tickets/[id]/feedback/route.ts:30` | `findFirst` | add `...NOT_DELETED` — it builds its own `where` |
| `app/api/tickets/[id]/reopen/route.ts:20` | `findUnique` | **convert to `findFirst`**, `where: { id, ...NOT_DELETED }` |
| `app/api/tickets/assign-sweep/route.ts:15` | `findMany` | add |
| `app/api/tickets/assign-sweep/route.ts:31` | `groupBy` | add |
| `app/api/tickets/assign-sweep/route.ts:64` | `findMany` | add |
| `app/api/dashboard/route.ts:35` | `groupBy` | add |
| `app/api/dashboard/route.ts:40, 41, 42` | three `count`s | add to each |
| `app/api/dashboard/route.ts:43` | `findMany` | add |
| `app/api/reports/route.ts:41, 42` | two `groupBy`s | add |
| `app/api/reports/route.ts:43` | `findMany` | add |
| `app/api/reports/agents/route.ts:13` | `findMany` | add |

`findUnique` cannot take a non-unique field in its `where`, which is why the three conversions above are required rather than stylistic. The `tx.ticket.update` calls at `[id]/route.ts:137`, `reopen/route.ts:31` and `assign-sweep/route.ts:74` keep `where: { id }` — each is preceded by a read that has already excluded deleted rows.

`prisma.feedback` and `prisma.comment` queries are **not** filtered: they are reached only through a ticket that was already checked, and `Feedback`/`Comment` cascade from `Ticket`, which a soft delete no longer triggers. That is intended — a ticket that is later restored keeps its thread.

---

## Edge Cases & Failure Modes

- **`GET()` called with no arguments** — `tests/api/customers.test.ts:27`. `withAuth` substitutes `new Request("http://localhost/")` (task 2) and `parsePagination` also accepts `undefined` (task 4). Either guard alone suffices; both exist because the two are written in different tasks and each must be safe on its own.
- **A second `auth()` call on every staff route.** `withAuth` calls `requireAgent()`/`requireAdmin()` for the decision and `requireUser()` for the identity, so an `agent` or `admin` route decodes the session cookie twice. Accepted, to keep the three guards' bodies untouched as the acceptance criteria require. It is not a correctness problem — `auth()` is a pure read. The follow-up, deliberately not done here, is a request-scoped session cache; that changes `auth.ts`'s contract and belongs in its own story.
- **`authorize()` cannot return 429.** Auth.js owns the response for `/api/auth/callback/credentials`, and `middleware.ts`'s matcher excludes `/api` (line 37). A throttled login therefore throws `RateLimitedSignin` and reaches the user as "Too many sign-in attempts…" from `app/(auth)/login/actions.ts` — **the HTTP status stays whatever Auth.js emits**. Rate limiting the callback from middleware would require adding it to the matcher *and* running middleware on the Node runtime, since an Edge-runtime middleware gets its own copy of the in-memory `Map` and would enforce a second, unrelated budget. That trade is not worth an eleventh story; the DB-lookup-and-hash-compare saving, which is what the criterion protects, is fully achieved.
- **No proxy header means one shared bucket.** `clientIp()` returns `"unknown"` when neither `x-forwarded-for` nor `x-real-ip` is set — the case for direct-to-Node local development. Every caller then shares one budget: 5 registrations per 10 minutes and 10 **failed** logins per 5 minutes for the whole machine. Charging only failed logins is what keeps that tolerable. A deployment must sit behind a proxy that sets `x-forwarded-for`; one that does not has a global lockout, not a per-attacker one.
- **`x-forwarded-for` is client-controllable when nothing strips it.** Behind a proxy that appends, the first entry is the real client. Directly exposed, an attacker sets a fresh value per request and the limiter is bypassed. This is the standard limitation of a header-based limiter and the reason this is a throttle, not a security boundary.
- **Counters reset on deploy and are per-process.** Both are stated in `lib/rate-limit.ts`'s header comment. On the single-process deployment this story targets, neither matters.
- **`MAX_KEYS` eviction.** At 5 000 distinct keys the oldest is dropped, which can hand an attacker a few extra attempts. The alternative is unbounded memory growth driven by request headers. Enforced in `recordAttempt` (task 1).
- **A page beyond the end.** `?page=999` on a 30-row list returns `{ tickets: [], total: 30, page: 999, pageSize: 25 }` — an empty array, **not** a 404. "Next" is disabled at `page * pageSize >= total`, so it is only reachable by hand-editing the URL.
- **`pageSize=0`, `pageSize=-1`, `pageSize=banana`, `page=0`.** All clamp in `parsePagination` — 1 ≤ `pageSize` ≤ 100, `page` ≥ 1. **No 400 is ever emitted for a pagination parameter.**
- **A filter change while on page 3** would show an empty table. Every `setFilters` call in `ticket-table.tsx` resets `page: 1` (task 5). This is the most likely bug in the frontend half of the story.
- **The count and the page can disagree under concurrency.** `findMany` and `count` run in one `Promise.all` but not in one transaction, so a ticket created between them can make `total` 26 while the page holds 25 of the previous 25. Accepted: the next refetch corrects it, and a serialisable transaction for a list read is the wrong trade.
- **A soft-deleted ticket's audit history stays visible.** `GET /api/admin/audit?ticketId=…` (`app/api/admin/audit/route.ts:13–14`) queries `AuditLog` directly and joins no ticket, so an admin still sees the whole history. That is the point of the change.
- **Deleting an already-deleted ticket.** The `findFirst` with `NOT_DELETED` returns nothing, so the second DELETE is a **404** — matching the old behaviour once the row was truly gone.
- **A customer holding a link to a soft-deleted ticket** gets a 404 from `GET /api/tickets/[id]`, because `ticketScopeWhere` now carries `deletedAt: null`. Same status as a ticket belonging to someone else — the codebase's established choice (`app/api/tickets/[id]/comments/route.ts:23`).
- **Report totals move once on delete.** A soft-deleted ticket leaves the `groupBy` counts at `app/api/reports/route.ts:41–42` and the resolution averages at 43–46 immediately. That is the same visible effect the hard delete had; only the row's survival differs.
- **Half-applied migration.** Column added but the query changes not deployed → soft-deleted tickets stay visible everywhere, which is the *old* behaviour with an extra column: no data is lost. Query changes deployed without the column → **every ticket query fails** with an unknown-column error. Apply the migration first; see `## Migration / Rollback`.
- **`prisma migrate dev` on a drifted dev database** offers to reset it, taking `prisma/dev.db` with it. Run `npx prisma migrate status` first.

---

## Test Plan

Add **one new file**; no existing test file is edited. `tests/setup/api.ts` gains one line (task 3) and is a setup file, not a test.

**Create file: `tests/api/guardrails.test.ts`** — `api` project, node environment, real SQLite. Follow `tests/api/tickets.test.ts` exactly: `vi.mock("@/auth", () => import("@/tests/mocks/auth"))` on line 1, then the `signInAs` import, then everything else. Use `jsonRequest` / `routeContext` from `tests/helpers/request.ts` and the factories from `tests/helpers/factories.ts`.

1. **`paginates tickets and reports the total`** — 5 tickets for one customer, signed in as an `AGENT`; `GET(new Request("http://test/api/tickets?pageSize=2&page=2"))` returns `tickets.length === 2`, `total === 5`, `page === 2`, `pageSize === 2`, and ids disjoint from page 1's.
2. **`clamps pageSize and page to legal values`** — `?pageSize=9999&page=0` returns **200** with `pageSize === 100` and `page === 1` (not a 400).
3. **`paginates customers`** — 3 customers; `GET(new Request("http://test/api/customers?pageSize=1"))` as an `AGENT` returns `customers.length === 1`, `total === 3`.
4. **`still answers GET() with no request`** — call the customers `GET()` with no arguments, as `tests/api/customers.test.ts:27` does; expect **200** and `page === 1`. The regression guard for the wrapper's `request ?? …` line.
5. **`throttles repeated registrations from one IP`** — `POST` the register route 5 times with distinct emails and a fixed `x-forwarded-for`, each **201**; the 6th is **429** with a `Retry-After` header, and `prisma.user.count()` is still 5. Build the requests by hand (`new Request(url, { method, headers, body })`) — `jsonRequest` sets no `x-forwarded-for`.
6. **`throttles per IP, not globally`** — immediately after the 6th above, a request with a different `x-forwarded-for` gets **201**.
7. **`soft-deletes a ticket and keeps its audit row resolvable`** — as an `ADMIN`, `DELETE` a ticket: **200**, then `prisma.ticket.findUnique({ where: { id } })` is **not null** with a non-null `deletedAt`, and the `AuditLog` row with `action: "TICKET_DELETED"` has an `entityId` matching a `Ticket` row that still exists.
8. **`hides a soft-deleted ticket from the list and the detail`** — after the delete, `GET /api/tickets` omits it and `total` drops by one; `GET /api/tickets/[id]` returns **404**.
9. **`excludes soft-deleted tickets from the dashboard counts`** — one `OPEN` ticket assigned to the agent gives `assigned.total === 1`; soft-delete it, and `assigned.total === 0` with `queue.unassigned` unchanged.
10. **`refuses a second delete of the same ticket`** — a repeated `DELETE` returns **404**.
11. **`keeps the existing 401/403 outcomes after the withAuth migration`** — three assertions in one test: signed out, `GET /api/customers` is **401**; as a `CUSTOMER`, **403**; as an `AGENT`, **200**. This is what proves the wrapper is a refactor and not a behaviour change.
12. **`still refuses a non-admin ticket delete`** — as an `AGENT`, `DELETE /api/tickets/[id]` is **403** and `deletedAt` is still null.

**No component test is added.** `TicketTable`, `CustomerTable` and `PortalTicketList` have no existing test file, and their first one would mean mocking `next-auth/react`, `@tanstack/react-query` and three client modules — a bigger surface than the pager it would cover. Recorded as the follow-up, not done here.

**Existing tests: none modified.** `tests/api/customers.test.ts:30` keeps reading `listed.customers` because the array keeps its key; `tests/api/tickets.test.ts` never calls the list `GET`; `assign-sweep`, `activity` and `feedback` create tickets with a null `deletedAt` and are unaffected.

---

## Migration / Rollback

- **Back up first:** `cp prisma/dev.db prisma/dev.db.story10.bak`. `prisma/*.db` and `prisma/*.bak` are already gitignored.
- **Apply:** `npx prisma migrate dev --name add_ticket_deleted_at`, then `npx prisma generate`. Confirm the generated SQL is the two statements shown in task 6 and **contains no `DROP`**.
- **Order matters.** The column must exist before any code that filters on it runs. In a deploy: migrate, then ship. Locally: migrate before `npm run dev`.
- **Rollback.** The application-code half is a plain `git revert` — nothing it changes is persisted. The column can be left in place: `deletedAt` is nullable and unread by the reverted code, so no data is lost and no reverse migration is needed. To remove it anyway, `ALTER TABLE "Ticket" DROP COLUMN "deletedAt";` **destroys the deletion record for every soft-deleted ticket** — export those rows first, or leave the column.
- **Reverting after tickets have been soft-deleted** makes them visible again, because the reverted code has no `deletedAt` filter. That is the correct failure direction: data reappears rather than vanishing.
- **The rate limiter and `withAuth` hold no persisted state**, so their rollback is the revert alone.

---

## Verification Steps

1. **Migration applied:** `npx prisma migrate status` in the repo root reports the database up to date, and `npx prisma migrate dev --name add_ticket_deleted_at` created exactly one new folder under `prisma/migrations/`.
2. **Backend builds:** `npx tsc --noEmit` in the repo root — zero errors. Run `npm run dev` once first if `.next/types` is stale, so `RouteContext<…>` resolves inside the wrapped handlers.
3. **Lint passes:** `npm run lint` in the repo root — zero errors.
4. **The guard grep is empty:** `grep -rn "requireAgent\|requireAdmin\|requireUser\|resolveViewer" app/ --include=*.ts --include=*.tsx` returns **only comment lines** (it returns 42 hits across 17 files today). `grep -rn "await auth()" app/` returns nothing outside `app/api/auth/`.
5. **Every route declares a role:** `grep -rLn "withAuth" app/api --include=route.ts` lists **exactly one** file — `app/api/auth/[...nextauth]/route.ts`.
6. **Regression suite:** `npm run test` in the repo root. **All 20 story-09 tests pass with unmodified assertions**, plus the 12 new ones — **32 passing, 0 failing**. Run it twice; both runs pass.
7. **Production build:** `npm run build` in the repo root succeeds.
8. **Frontend runs — pagination:** `npm run dev`, sign in as an agent, seed more than 25 tickets, open `/agent/tickets`. Exactly 25 rows, a "Showing 1–25 of N" line, "Previous" disabled and "Next" enabled. Click "Next" — rows change without the table dropping into "Loading tickets…". Change the status filter — the view returns to page 1.
9. **Frontend runs — customers and portal:** the same two checks on `/agent/customers` and `/portal/tickets`.
10. **Register throttle, by hand:** `for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/register -H 'Content-Type: application/json' -d "{\"name\":\"T\",\"email\":\"t$i@x.example\",\"password\":\"password123\"}"; done` prints five `201`s then a `429`. `curl -i` on the sixth shows a `Retry-After` header.
11. **Login throttle:** submit the login form with a wrong password 10 times, then once more — the eleventh shows "Too many sign-in attempts. Try again in a few minutes." A **correct** password submitted 10 times in a row is never throttled.
12. **Soft delete end to end:** as an admin, delete a ticket from `/agent/tickets/[id]`. It disappears from `/agent/tickets`, from the dashboard counts and from `/agent/reports`. Then `npx prisma studio` → the `Ticket` row **still exists** with `deletedAt` set, and the audit view shows the `TICKET_DELETED` entry whose `entityId` matches that surviving row.
13. **Regression — no authorisation drifted:** signed out, every `/api/**` route except `/api/register` and `/api/auth/**` returns **401**. As a `CUSTOMER`: `/api/customers` **403**, `/api/dashboard` **403**, `/api/reports` **403**, `/api/admin/*` **403**, `/api/notifications` **200** with an empty list, `/api/tickets` **200** scoped to their own. As an `AGENT`: `/api/admin/*` and `/api/reports/agents` **403**, everything else as before. **Any status that differs from before this story is a bug in the migration, not a decision.**

---

## Done Criteria

- [ ] `withAuth(options, handler)` exists in `lib/api/http.ts`, requires `options.role`, supports `"public" | "user" | "agent" | "admin" | "viewer"`, and takes an optional `rateLimit`.
- [ ] `requireAgent()`, `requireAdmin()` and `resolveViewer()` are unchanged in behaviour and signature; `requireUser()` changes only by **adding** `name` to its payload. All four are called from inside `withAuth` and remain the only implementation of the role checks.
- [ ] **Every** route file under `app/api/**` exports its handlers through `withAuth`, except `app/api/auth/[...nextauth]/route.ts`, whose exemption is stated in a comment. `grep -rLn "withAuth" app/api --include=route.ts` names that one file and no other.
- [ ] `grep -rn "requireAgent\|requireAdmin\|requireUser\|resolveViewer\|await auth()" app/` returns no hits outside comments and `app/api/auth/`.
- [ ] **No route's 401/403/404 outcome changed.** Verification step 13 passes for all three roles and for the signed-out case.
- [ ] `GET /api/tickets` and `GET /api/customers` accept `page` and `pageSize`, apply them via Prisma `skip`/`take`, default `pageSize` to **25**, cap it at **100**, clamp every malformed value instead of returning 400, and respond with `{ total, page, pageSize }` **beside the existing `tickets` / `customers` array**.
- [ ] On each of those endpoints the `count` and the `findMany` are built from **one shared `where`**.
- [ ] `TicketTable`, `PortalTicketList` and `CustomerTable` render one page at a time with a working Previous/Next pager, use `placeholderData: keepPreviousData`, and reset to page 1 whenever a filter changes.
- [ ] `lib/rate-limit.ts` exists with `checkRateLimit`, `recordAttempt`, `resetRateLimits`, `clientIp` and `RATE_LIMITS`, holds state in a bounded in-process `Map`, and **adds no dependency** — `git diff package.json` is empty.
- [ ] `POST /api/register` returns **429** with a `Retry-After` header past the threshold, **before** `readJson`, Zod, or any database call.
- [ ] The credentials `authorize()` checks the throttle **before** `prisma.user.findUnique` and `verifyPassword`, charges failed attempts only, and surfaces on the login form as "Too many sign-in attempts. Try again in a few minutes." **Known deviation from the intake's literal wording:** the status for the login path is Auth.js's, not a 429 — the reason is recorded in `## Edge Cases & Failure Modes` and in a comment in `auth.ts`.
- [ ] `Ticket.deletedAt` is a nullable `DateTime` with `@@index([deletedAt])`, added by one migration containing an `ALTER TABLE` and a `CREATE INDEX` and **no backfill**.
- [ ] `DELETE /api/tickets/[id]` sets `deletedAt` instead of deleting the row, inside the existing `$transaction`, and still writes its `TICKET_DELETED` audit row — whose `entityId` now resolves to a surviving `Ticket`.
- [ ] `ticketScopeWhere()` excludes soft-deleted rows for all three viewer kinds, and every ticket query in task 6's table either goes through it or spreads `NOT_DELETED`. The three `findUnique` calls that cannot filter on a non-unique column are converted to `findFirst`.
- [ ] `npm run test` reports **32 passing, 0 failing**, twice in a row, with **all 20 story-09 tests' assertions unmodified**; the only edit to an existing file under `tests/` is the `resetRateLimits()` line in `tests/setup/api.ts`.
- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
