# dashboard — plan overview

Entry point for the **dashboard** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 07 | [`07-story-agent-dashboard-assigned-tickets-queue-and-faq.md`](07-story-agent-dashboard-assigned-tickets-queue-and-faq.md) | Agent dashboard: assigned tickets, queue, and FAQ | — | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), [`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), [`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), [`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md) |

## Dependency notes

- **Story 07 depends on Story 01** (commit `8534be4`) for `lib/prisma.ts`, `auth.ts`, `app/providers.tsx`, `app/agent/layout.tsx`, `app/portal/layout.tsx`, `components/agent/sidebar-nav.tsx`, and `components/portal/top-nav.tsx`. **On Story 02** for the `lib/customers.ts` client-module idiom. **On Story 05** (commit `ee1482f`) for the `Ticket` model, `lib/sla.ts`, `lib/tickets.ts`'s `TicketListItem`, and `components/agent/tickets/ticket-table.tsx`'s SLA-badge markup. **On Story 06** for `requireUser()` (`lib/api/http.ts:32–40`) and for the notification bell that shares the sidebar with the dashboard link. **Story 06 is implemented but not committed** at planning time — `git status` shows its files untracked. Commit it before starting Story 07; if `requireUser()` is missing from `lib/api/http.ts`, stop rather than re-declare it.
- **Story 07 is a read-only composition, not a new subsystem.** It adds **no Prisma model, no migration, and no seed change**. Every number it renders is a `count` or a `groupBy` over Story 05's `Ticket` table, and every ticket row is Story 05's list projection. A diff that touches `prisma/schema.prisma` is a bug in the implementation, not a design change.
- **Shared contracts introduced by Story 07** — later stories consume these rather than redefining them:
  - `lib/ticket-select.ts` → **`TICKET_LIST_SELECT`**, the list-row projection lifted out of `app/api/tickets/route.ts:15–25` because a Next `route.ts` cannot export a non-handler symbol. It is the server-side counterpart of `TicketListItem` (`lib/tickets.ts:20–31`); the two are hand-kept in sync and TypeScript cannot see across the JSON boundary between them. **`TICKET_DETAIL_SELECT` is deliberately left duplicated** across `app/api/tickets/[id]/route.ts` and `.../reopen/route.ts` — de-duplicating it is a separate change.
  - `lib/sla.ts` gains **`slaBreachedWhere()`** and **`liveStatusWhere()`**, and **exports `TERMINAL_STATUSES`**. These are a Prisma `where` projection of the rule `isSlaBreached()` already implements on a row, so an aggregate can run in SQL instead of loading every ticket. **Both projections read the same `TERMINAL_STATUSES`** — a third spelling of `["RESOLVED", "CLOSED"]` anywhere in the codebase means the SQL count and the row badge can disagree, and is the one failure this story is written to prevent.
  - `app/api/dashboard/route.ts` → **`GET /api/dashboard`**, returning `{ assigned: { total, byStatus, breached }, queue: { unassigned, breached }, tickets }` in **one** response, following `GET /api/notifications`'s composite-payload shape rather than a bare array.
  - `lib/dashboard.ts` → the client module (`DashboardSummary`, `dashboardKeys`, `fetchDashboardSummary`), following the `lib/notifications.ts` shape. **`dashboardKeys` is a separate cache tree from `ticketKeys`** — invalidating one does not touch the other, on purpose.
  - `lib/faq.ts` → **`FAQ_ENTRIES`**, hardcoded. Its SLA figures restate `SLA_HOURS` (`lib/sla.ts:16–20`) in prose; change both in the same commit.
- **Behaviour introduced by Story 07** — later stories must assume these semantics:
  - **The agent dashboard is `app/agent/page.tsx`, not `app/agent/dashboard/`.** The intake names the latter, but `/agent` is already the route `components/agent/sidebar-nav.tsx:11` labels "Dashboard" and the only one its `pathname === "/agent"` check highlights. A deliberate deviation from the intake's wording, not an oversight.
  - **`GET /api/dashboard` returns `403` for a CUSTOMER**, unlike `GET /api/notifications`, which returns an empty `200`. `queue.unassigned` is internal workload depth and has no customer-shaped reading.
  - **`assigned.total` counts every status; `tickets` and `queue.unassigned` exclude terminal ones.** The tiles answer "what is on my plate, in what state"; the list answers "what do I work on next".
  - **The dashboard query sets `staleTime: 0` and no `refetchInterval`.** The provider-wide `staleTime: 30_000` (`app/providers.tsx:12`) would otherwise show stale counts for half a minute after a claim made on `/agent/tickets`. The dashboard is not a live monitor; the bell's 30 s poll stays the only interval in the app.
  - **The dashboard performs no mutation and has no Claim button.** It links to `/agent/tickets`, where Story 05's `authorizeAssignmentChange` already owns the race between two claimants.
  - **The five dashboard queries share one `now` but no transaction.** A read-only page does not justify holding SQLite's write lock; the shared clock removes the only inconsistency worth removing.
  - **`/portal/faq` is customer-only.** `middleware.ts:31` redirects staff to `/agent`. Making the FAQ public (an `app/help` route plus a widened matcher) is a deliberate deferral.
- **Deferred out of Story 07:**
  - **Charts and aggregate reporting** — named in the intake's out-of-scope list and reserved for a separate story. The `groupBy` in `app/api/dashboard/route.ts` is a count per status, not the start of a reporting layer.
  - **Proactive SLA escalation and notification.** Story 06's `notify()` is not called from anything in this story.
  - **A dynamic or searchable knowledge base**, and any AI-generated FAQ content.
  - **Pagination of the assigned-ticket list.** It is capped at 10 rows above unbounded counts; `/agent/tickets` is the full list.
  - **Per-agent or team-wide dashboards.** Every number is scoped to `assignedAgentId === caller`, including for an ADMIN.
  - **De-duplicating `TICKET_DETAIL_SELECT`.** Only the list select moves in this story.
- **Still no automated test framework.** Stories 01–06 all deferred it and Story 07's intake does not ask for one either, so this ships a manual + `curl` test plan. `slaBreachedWhere` and `liveStatusWhere` are pure and argument-defaulted for the same reason `authorizeAssignmentChange` and `describeTicketChanges` were — they belong in the first test suite this repo grows.
