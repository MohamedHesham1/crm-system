# guardrails — plan overview

Entry point for the **guardrails** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 11 | [`11-story-production-hardening-enforced-auth-pagination-and-safer-deletes.md`](11-story-production-hardening-enforced-auth-pagination-and-safer-deletes.md) | Production hardening: enforced auth, pagination, and safer deletes | — | Stories 01–10, and [`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md) as the regression baseline |

## Dependency notes

- **This feature is corrective, not additive.** Story 11 came out of a post-implementation review of the finished application, not the original feature list. It adds no user-facing feature; it changes how four existing behaviours are declared and enforced.
- **Story 03** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md)) owns `lib/api/http.ts`, the file Story 11 extends most. `requireAgent()`, `requireAdmin()` and `requireUser()` keep their bodies and their signatures — the new `withAuth()` wrapper calls them rather than replacing them, so no route's 401/403 outcome moves. `requireUser()` gains one field (`name`) and nothing else.
- **Story 05** ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md)) owns `lib/ticket-access.ts`. `ticketScopeWhere()` becomes the single place the soft-delete filter is applied for scoped reads; the queries that build their own `where` (dashboard, reports, the assignment sweep, the feedback route) spread a new `NOT_DELETED` constant instead.
- **Story 08** ([`../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md`](../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md)) is the template for the schema change. `Ticket.deletedAt` is the same shape as `Ticket.resolvedAt`: a nullable `DateTime` plus one index, in one migration — except that `deletedAt` needs no backfill, because `NULL` already means "not deleted".
- **Story 09** ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md)) is the hard boundary. All 20 of its tests must pass with **unmodified assertions**; the only permitted edit under `tests/` to an existing file is one `resetRateLimits()` line in `tests/setup/api.ts`, which is a setup file rather than a test. Two of its tests constrain the design directly: `tests/api/customers.test.ts:27` calls the exported `GET()` with **no arguments**, so `withAuth` must tolerate a missing `Request`; `tests/api/customers.test.ts:30` reads `listed.customers`, so the paginated response keeps its array under the existing key and only adds `{ total, page, pageSize }` beside it.
- **Shared contracts introduced by Story 11** — later stories extend these rather than inventing a second style:
  - **`withAuth(options, handler)`** in `lib/api/http.ts`. A new route handler declares `role` (`"public" | "user" | "agent" | "admin" | "viewer"`) at its export or does not compile. `app/api/auth/[...nextauth]/route.ts` is the only exemption, and says so in a comment.
  - **`lib/rate-limit.ts`** — an in-process sliding-window counter with `checkRateLimit` / `recordAttempt` split, so a caller can charge failures only. `resetRateLimits()` is the test seam.
  - **`lib/api/pagination.ts`** — `parsePagination(request)`, offset-based, `pageSize` default 25 and max 100, every malformed value clamped rather than rejected.
  - **`Paginated<T>` = `{ items, total, page, pageSize }`** in `lib/tickets.ts`, imported by `lib/customers.ts`. New paginated client functions return this shape.
  - **`NOT_DELETED`** in `lib/ticket-access.ts`. A ticket query that neither spreads it nor goes through `ticketScopeWhere()` is a bug.
- **Deferred out of Story 11:**
  - **Server-side prefetch/hydration** for the dashboard and ticket-list pages — a real improvement, but a rendering change rather than a hardening fix, and better scoped as its own story.
  - **A distributed (Redis-backed) rate limiter.** The in-process limiter resets on deploy and is per-instance; both are accepted for a single-process deployment.
  - **A real 429 on the login path.** `authorize()` cannot set a status, so a throttled sign-in surfaces as an error code and a message. Doing it properly means a Node-runtime middleware and a second copy of the store.
  - **Soft delete for any model other than `Ticket`**, an undelete/restore UI, and cursor-based pagination.
  - **Component tests for the three paginated tables.** None of them has a test file today; their first one is a larger mocking job than the pager warrants.
  - **A request-scoped session cache.** `withAuth` calls `auth()` twice on staff routes — once for the decision, once for the identity — because the three guards' bodies stay untouched.
