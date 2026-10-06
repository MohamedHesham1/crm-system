# Story 14 — Ticket escalation status and SLA breach alerts

## Prerequisites

- Story 05 completed: [`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md) owns ticket status validation and SLA calculations.
- Story 06 completed: [`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md) owns `Notification`, notification validation/writes, and the staff notification bell.
- Story 09 completed: [`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md) establishes API and component regression coverage.
- Story 13 completed first: [`../collaboration/13-story-internal-notes-and-quick-replies.md`](../collaboration/13-story-internal-notes-and-quick-replies.md). Apply the Comment migration before Story 14's Notification migration; do not combine or reorder the migrations.

---

## Story Goal

Let staff mark an active ticket `ESCALATED` without stopping its existing SLA
clock. Add an externally invoked, platform-neutral cron endpoint that finds
breached tickets and idempotently creates an in-app alert for the current
assignee. The endpoint is protected by a configured bearer secret and reuses
the existing notification feed and bell.

The deployment operator provisions the scheduler. This story supplies the
endpoint and its operating documentation, not vendor-specific scheduler
infrastructure.

---

## Context — Read These Files First

1. `lib/validation/ticket.ts` — `TICKET_STATUSES` is at line 9 and drives `TicketStatus` at line 12 and the update schema at line 69. This is the single status contract.
2. `lib/sla.ts` — `isSlaBreached()` starts at line 32 and `slaBreachedWhere()` at line 69. Keep the query predicate consistent with the computed breach rule and `TERMINAL_STATUSES`.
3. `app/api/tickets/[id]/route.ts` — `GET` projects `slaBreached` at lines 14–23; `PATCH` validates status at lines 27–40 and protects closed tickets beginning at line 81. Keep `ESCALATED` non-terminal without bypassing closed-ticket protection or `resolvedAt` handling.
4. `prisma/schema.prisma` — `Ticket` starts at line 59 and its `status` String is at line 69; `Notification` is at lines 189–205. Add only an optional unique deduplication key to notifications; do not add a Prisma enum or change existing notification ownership.
5. `lib/validation/notification.ts` — `NOTIFICATION_TYPES` starts at line 21. Add the breach type here as the sole source of valid notification type strings.
6. `lib/activity.ts` — `NotificationInput` and `notify()` are at lines 11–31. Preserve existing writers and use the established notification input contract for recipient, message, and related ticket.
7. `lib/api/http.ts` — `AuthRole` is at line 67; `withAuth()` starts at line 99, and its explicit `"public"` path is at line 117. The cron handler must still use `withAuth` and independently verify its bearer secret.
8. `lib/ticket-access.ts` — `NOT_DELETED` is at line 61. Combine it with the shared breach predicate so soft-deleted tickets are excluded.
9. `components/agent/tickets/ticket-table.tsx` — the status filter maps `TICKET_STATUSES` at line 81. `components/agent/tickets/ticket-detail.tsx` renders the staff status selector around lines 106–117. `components/ui/status-badge.tsx` maps every `TicketStatus` at lines 5–13. Update the badge mapping and verify the data-driven filter and selector include the new status.
10. `components/agent/dashboard/summary-cards.tsx` — summary cards map `TICKET_STATUSES` at lines 12–18. `components/agent/reports/ticket-breakdown-charts.tsx` maps the tuple at line 15. Keep dashboard and report counts keyed to the expanded type.
11. `app/api/notifications/route.ts` — the authenticated feed begins at line 7 and selects standard notification fields at lines 9–21. The new notification must flow through this existing user-scoped feed.
12. `components/agent/notification-bell.tsx` — the bell fetches its feed at lines 18–31 and links ticket notifications at lines 67–79. Keep generic display and the existing 30-second poll; ensure the new type is compatible with the feed.
13. `tests/api/assign-sweep.test.ts` — follow the authenticated route, real SQLite, fixture, and repeat-call test pattern for the cron route.
14. `tests/helpers/factories.ts` — `createTicket()` is at lines 37–61 and accepts status, assignment, and due-date overrides for deterministic breach fixtures.
15. `.env.example` and `README.md` — document the required cron secret and how an external scheduler invokes the endpoint; do not put a real secret in tracked files.

---

## Product rules (from story)

- `ESCALATED` is non-terminal. It does not change the existing SLA deadline or stop breach calculation; only the current `TERMINAL_STATUSES` stop the clock.
- Notify the current assigned staff member only. An unassigned ticket creates no notification.
- At most one `SLA_BREACHED` notification is created for the combination of ticket, current recipient, and due date. Repeated or concurrent scheduler requests are safe.
- The cron endpoint is `POST /api/cron/sla-alerts`, is wrapped with `withAuth({ role: "public" })`, and rejects requests unless the bearer token equals the configured `CRON_SECRET`. A `"public"` wrapper alone is not authorization.

---

## Implementation tasks

### 1 — Add escalation to the existing status contract and UI

**Files: `lib/validation/ticket.ts`, `components/ui/status-badge.tsx`, `components/agent/tickets/ticket-table.tsx`, `components/agent/tickets/ticket-detail.tsx`, `components/agent/dashboard/summary-cards.tsx`, `components/agent/reports/ticket-breakdown-charts.tsx`**

- Add `"ESCALATED"` to `TICKET_STATUSES`; derive all ticket status types from that tuple as today.
- Add an intentional badge variant for `ESCALATED` in `STATUS_VARIANT`.
- Confirm the existing ticket filter, detail selector, dashboard summary, and reports derive values from `TICKET_STATUSES` and render the new state without duplicating a second status list.
- Do not change `TERMINAL_STATUSES`, default SLA hours, ticket database columns, or closed-ticket transition rules. `Ticket.status` is string-backed, so this step has no schema migration.

### 2 — Add an idempotency key for SLA notifications

**File: `prisma/schema.prisma`**

- Add nullable `dedupeKey String? @unique` to `Notification`. Existing notifications keep `NULL`; SQLite unique indexes allow multiple null values.
- Generate a separate additive SQLite migration under `prisma/migrations/`. Do not alter notification user/ticket foreign-key actions or the existing feed index.
- Use a deterministic key including ticket id, current assignee id, and the exact due date. A changed assignee or deadline receives a distinct alert key.

### 3 — Extend the notification type contract

**File: `lib/validation/notification.ts`**

- Add `"SLA_BREACHED"` to `NOTIFICATION_TYPES`. Do not duplicate the type list in API or component code.
- Keep the existing feed/client types derived from `NotificationType`; do not expose `dedupeKey` in notification responses.

### 4 — Implement a secret-guarded, idempotent cron endpoint

**Create file: `app/api/cron/sla-alerts/route.ts`**

- Export `POST` through `withAuth({ role: "public" }, handler)`.
- Fail with an explicit server error if `CRON_SECRET` is missing; return `401` for a missing or invalid bearer token. Compare the supplied token without logging secrets and avoid calling the database until token validation succeeds.
- Query tickets with `slaBreachedWhere(now)`, `NOT_DELETED`, and a non-null assignee. Select only `id`, `subject`, `dueAt`, and `assignedAgentId`. A ticket with a null deadline, terminal status, soft deletion, or no assignee must not create an alert.
- For each result, upsert a `Notification` using the deterministic unique `dedupeKey`, type `"SLA_BREACHED"`, the assignee as `userId`, and the ticket as `relatedTicketId`. Use an empty update so retries preserve `read` state and original creation time.
- Return a small result summary containing the number of breach candidates checked. Let unexpected Prisma errors propagate to the route's standard server-error handling; do not return success-shaped fallbacks.
- Keep the scheduled route protected by the bearer token even though the required wrapper role is `"public"`. Do not add an unwrapped API route.

### 5 — Document scheduler invocation and configuration

**Files: `.env.example`, `README.md`**

- Add a placeholder `CRON_SECRET` entry to `.env.example`; never commit a usable token.
- Document that operators configure a high-entropy `CRON_SECRET` in deployment and schedule `POST /api/cron/sla-alerts` with an Authorization bearer token whose value is read from `CRON_SECRET`.
- State that the scheduler itself is external and vendor-specific setup is not supplied.

### 6 — Add focused API and status regression tests

**Create file: `tests/api/sla-alerts.test.ts`**

- Set and restore a test-only `CRON_SECRET`; invoke the exported `POST` with a `Request` carrying the bearer token.
- Verify missing configuration and invalid/missing token fail before database writes.
- Verify a breached assigned non-terminal ticket creates one alert for its assignee; a second call does not duplicate it or reset `read`.
- Verify changed assignee/deadline can produce a distinct notification; unassigned, not-yet-breached, terminal, and soft-deleted tickets do not.
- Verify customers/admins not assigned to the ticket are not recipients.

**Update or create files under `tests/` only where status UI coverage requires it.**

- Add status contract assertions to an existing API/component test or create a focused component test under `tests/components/` for the escalated badge and selector option.
- Preserve `tests/components/ticket-status-control.test.tsx` and `tests/components/sla-badge.test.tsx` behavior.

---

## Edge Cases & Failure Modes

- Missing `CRON_SECRET`: fail closed with a server configuration error before any database query; do not treat the endpoint as open.
- Missing or wrong bearer token: return `401`, create no notification, and do not log the credential.
- Duplicate or concurrent invocation: the unique dedupe key and upsert prevent duplicate alerts; an existing read notification stays read.
- Null `dueAt`, terminal ticket, soft-deleted ticket, or unassigned ticket: do not notify. Use `slaBreachedWhere()` and `NOT_DELETED`, rather than duplicating deadline/status logic.
- Ticket's assignee changes after a breach: key includes the recipient, so the new assignee can receive an alert on the next invocation; the former assignee's record remains unchanged.
- Ticket deadline changes: key includes the due date, so the new deadline can generate its own notification without mutating the existing alert.
- `ESCALATED` status transition: remain non-terminal and keep SLA breach computation active. Do not add it to `TERMINAL_STATUSES`.
- Notification upsert failure: surface a failed request and do not report a successful checked count; retry remains safe because upserts are idempotent.

---

## Test Plan

1. **API integration:** create `tests/api/sla-alerts.test.ts` using `tests/api/assign-sweep.test.ts`, `tests/helpers/factories.ts`, and the real test database. Cover bearer authorization, filters, recipients, idempotency, and preservation of read state.
2. **Status contract/UI:** assert `ESCALATED` is accepted by the status validation and represented in the badge; verify the detail selector and data-driven filters expose it.
3. **Regression:** run `npm test` and preserve the existing ticket, dashboard, report, SLA badge, and notification bell tests.

---

## Migration / Rollback

- Add only `Notification.dedupeKey` as an optional unique column. Existing rows remain valid with null keys.
- Apply Story 13's comment migration first, then this notification-key migration. Do not deploy code requiring the key before migration completes.
- If migration fails, stop deployment and restore the pre-migration database before retrying. Rollback by reverting application code and restoring a backup; dropping the key column after alerts are written removes deduplication state and can cause repeated alerts.

---

## Verification Steps

1. **Backend builds:** from the repository root, run `npx prisma validate` and `npx prisma generate`.
2. **Tests pass:** run `npm test` from the repository root, including the new route tests on the isolated SQLite database.
3. **Static checks:** run `npm run lint` and `npm run build` from the repository root.
4. **Cron smoke test:** configure a temporary local `CRON_SECRET`, create one assigned overdue ticket, and `POST /api/cron/sla-alerts` with the matching bearer token. Confirm one bell notification; repeat and confirm no duplicate.
5. **Status regression:** set an active ticket to `ESCALATED`; confirm it appears in the status selector, badge, list filter, dashboard, and reports and continues to be evaluated by the SLA helper.

---

## Done Criteria

- [ ] Staff can set `ESCALATED`; filters, badges, dashboard, and reports include it.
- [ ] `ESCALATED` remains non-terminal and does not stop or rewrite the SLA clock.
- [ ] The wrapped cron endpoint rejects unauthorized calls and requires `CRON_SECRET`.
- [ ] Only the currently assigned staff member receives an overdue-ticket alert; unassigned tickets remain unnotified.
- [ ] Repeated calls are idempotent per ticket, assignee, and due date and do not reset notification read state.
- [ ] Operator instructions and a placeholder environment variable are documented without committing a real secret.
- [ ] API/UI tests pass with the existing suite; `.squad/plans/escalation/00-overview.md` and `.squad/plans/00-index.md` list the story.
