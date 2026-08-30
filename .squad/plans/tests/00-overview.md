# tests — plan overview

Entry point for the **tests** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 09 | [`09-story-test-coverage-across-the-application.md`](09-story-test-coverage-across-the-application.md) | Test coverage across the application | — | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), [`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), [`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), [`../registration/04-story-customer-self-registration-with-automatic-account-linking.md`](../registration/04-story-customer-self-registration-with-automatic-account-linking.md), [`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), [`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md), [`../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md`](../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md), [`../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md`](../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md) |

## Dependency notes

- **Story 09 depends on every prior story, and on all of them being committed.** It adds no feature; it tests the ones already shipped: Story 01 (`8534be4`) for `lib/prisma.ts`, `auth.ts` and `app/providers.tsx`; Story 02 (`fff097a`) for `app/api/customers/route.ts` and `components/agent/customers/customer-form.tsx`; Story 03 (`ea52bab`) for `lib/api/http.ts`'s guards; Story 04 (`cd32c28`) for `lib/registration.ts` and `Customer.userId`; Story 05 (`ee1482f`) for the ticket routes, `lib/sla.ts` and `lib/ticket-access.ts`; Story 06 (`e148a5f`) for `lib/activity.ts` and the notification bell; Story 07 (`4a732d1`) for `components/agent/dashboard/assigned-ticket-list.tsx`; Story 08 (`e052f6e`) for the feedback route and `Ticket.resolvedAt`.
- **This is the story Stories 01–08 kept deferring.** Every one of their plans closed with "still no automated test framework", naming the pure helpers (`authorizeAssignmentChange`, `describeTicketChanges`, `slaBreachedWhere`, `summariseSla`) as the code that most wanted the first suite. Story 09 grows it — though it spends its 20 tests on **route handlers and components**, not on those pure functions, because the acceptance criteria are written in terms of HTTP behaviour and rendered UI.
- **Story 09 changes no application code.** The intake forbids restructuring for testability. The only existing files it touches are `package.json` (one `test` script, six devDependencies) and `package-lock.json`. A diff that edits anything under `app/`, `components/`, `lib/` or `prisma/` is a bug in the implementation.
- **Shared contracts introduced by Story 09** — later stories extend these rather than inventing a second testing style:
  - **`vitest.config.ts` with two projects**, `api` (`node`) and `components` (`jsdom`), in one file. **`vitest.workspace.ts` does not exist and must not be added** — it is removed in Vitest 4.
  - **`tests/mocks/auth.ts`** → `signInAs()` plus a stand-in `auth()`. Registered with `vi.mock("@/auth", () => import("@/tests/mocks/auth"))`, a factory that closes over nothing and therefore dodges the `vi.mock` hoisting TDZ. **This is the only application module the API suite mocks.**
  - **`tests/helpers/db.ts`** → `resetDb()`, whose delete order encodes the `Restrict` foreign keys on `AuditLog.actor`, `Comment.author` and `Ticket.customer`. A new model means a new line here, in FK order.
  - **`tests/helpers/factories.ts`** → `createUser` / `createCustomer` / `createTicket`, all writing real rows. `passwordHash` is the literal `"test-hash"` — no test goes through `authorize()`.
  - **`tests/helpers/request.ts`** → `jsonRequest()` and `routeContext()`, the latter wrapping `params` in a **Promise**, which is what a Next 16 handler awaits.
  - **`tests/helpers/render.tsx`** → `renderWithQuery()`, a per-test `QueryClient` with `retry: false`. It deliberately does **not** reuse `app/providers.tsx`, which would also mount `SessionProvider`.
  - **`tests/stubs/next-link.tsx`**, aliased over `next/link` for the `components` project only.
  - **`prisma/test.db`**, created by `tests/global-setup.ts` with `prisma db push --force-reset --skip-generate` and selected by a per-project `DATABASE_URL` of `file:./test.db` (resolved relative to `schema.prisma`, like `.env`'s). Already covered by `.gitignore`'s `/prisma/*.db`.
- **Behaviour and conventions Story 09 establishes** — later stories must follow these:
  - **API tests are integration tests against real SQLite.** Prisma is never mocked. The suite exists to pin `$transaction` rollback and `@unique` constraints, and a mocked client would assert neither.
  - **Route handlers are imported and called directly.** That is not a bypass of authorisation: `middleware.ts` excludes `/api/**` from its matcher (line 37), so each handler's own `requireAgent()` / `requireAdmin()` / `resolveViewer()` call *is* the enforcement being tested.
  - **`fileParallelism: false`.** One SQLite file tolerates one writer. Do not answer a `SQLITE_BUSY` with retries.
  - **`globals` stays `false`.** Every test imports `describe` / `it` / `expect` / `vi` explicitly, and `tests/setup/dom.ts` registers `afterEach(cleanup)` by hand, because RTL's auto-cleanup only hooks a *global* `afterEach`. Adding `"types": ["vitest/globals"]` to `tsconfig.json` would drop the ambient `@types/node` and Next types — **do not**.
  - **Radix components need jsdom polyfills** — `hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`, `scrollIntoView`, `ResizeObserver`. They are conditional, so a future jsdom that ships them wins.
  - **No `@vitejs/plugin-react` and no `vite-tsconfig-paths`.** `"jsx": "react-jsx"` covers the transform, one hand-written alias covers `@/*`, and plugin-react's 6.x peer range (`vite@^8`) can conflict with the Vite that Vitest resolves.
- **Deferred out of Story 09:**
  - **End-to-end and browser tests** (Playwright and similar) — named in the intake's out-of-scope list.
  - **Coverage percentages and any coverage reporter.**
  - **Pixel-precise tests of `/portal/faq` and `/agent/reports`.**
  - **CI wiring.** `npm run test` is the whole interface; nothing schedules it.
  - **Unit tests for the pure helpers** — `lib/report-metrics.ts`'s `summariseSla` / `summariseAgents`, `lib/sla.ts`'s arithmetic, `lib/activity.ts`'s `describeTicketChanges`. They are the cheapest tests in the repo and the obvious next increment; the 16–20-test budget went to the criteria the intake actually listed.
  - **An injectable clock.** `POST /api/tickets/assign-sweep` and `GET /api/dashboard` both read `new Date()` through default arguments, so their tests move fixture timestamps instead of freezing time. Threading an optional `now` through both handlers is a later, deliberate refactor — the intake forbids doing it inside this story.
