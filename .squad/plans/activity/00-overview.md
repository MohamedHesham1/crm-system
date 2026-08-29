# activity — plan overview

Entry point for the **activity** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 06 | [`06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](06-story-audit-trail-and-in-app-notifications-for-ticket-events.md) | Audit trail and in-app notifications for ticket events | — | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), [`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), [`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md) |

## Dependency notes

- **Story 06 depends on Story 01** (commit `8534be4`) for `lib/prisma.ts`, `auth.ts`, `app/providers.tsx`, and `components/agent/sidebar-nav.tsx`. **On Story 03** (commit `ea52bab`) for `requireAdmin()`, the `app/agent/admin/layout.tsx` ADMIN gate that the new audit page inherits with no code of its own, the `/api/admin/**` convention, and `lib/api/client.ts`'s `ApiError` / `request<T>()`. **On Story 05** (commit `ee1482f`) for every handler it hooks into, for `lib/ticket-access.ts`'s `Viewer` / `resolveViewer()`, and for the `Ticket` and `Comment` models. All three are committed — unlike Story 05's situation at planning time, there is no uncommitted prerequisite to resolve first.
- **Story 06 is additive to Story 05, never a rewrite.** Every hook is a planner call plus a `$transaction` wrapper around a write that already exists. Authorisation decisions, status guards, `select`s, and response bodies from Story 05 are unchanged; a diff hunk that touches one of those is a bug in the implementation, not a design change.
- **Shared contracts introduced by Story 06** — later stories consume these rather than redefining them:
  - `prisma/schema.prisma` → **`AuditLog`** and **`Notification`**. `action` and `type` are `String`s, not Prisma enums, for the same reason `Ticket.status` is: **SQLite has no `enum`**. The allowed values live in `lib/validation/notification.ts` (`AUDIT_ACTIONS`, `NOTIFICATION_TYPES`) and **must not** be re-listed anywhere else.
  - **`AuditLog.entityId` is deliberately not a foreign key.** `DELETE /api/tickets/[id]` exists, and the row recording a deletion is exactly what an FK would cascade away. Every read path must treat `entityId` as possibly dangling — `components/agent/admin/audit-table.tsx` renders "deleted" rather than a link when the ticket is gone.
  - **The two models' referential actions are deliberately opposite:** `AuditLog.actor` is `Restrict` (history outlives nothing; an account with a trail cannot be deleted), `Notification.user` and `Notification.relatedTicket` are both `Cascade` (a notification is worthless without its recipient or its ticket). Do not make them consistent with each other.
  - `lib/activity.ts` → **`logActivity()`** and **`notify()`**, both taking a `Prisma.TransactionClient` as their **first, required** argument. There is no fire-and-forget variant and none may be added: a log entry that survives a rolled-back mutation is a lie. Plus the two pure planners, **`describeTicketChanges()`** and **`assignmentNotifications()`** — no Prisma, no `Request`, so the whole decision table is testable, exactly like Story 05's `authorizeAssignmentChange`.
  - **`notify()` drops every entry addressed to the actor.** That one filter is the single implementation of "notify the assignee, not the comment author" and of "an agent is not told about their own claim". Call sites never check "is this me?" themselves; a second copy of that rule is a bug.
  - `lib/api/http.ts` → **`requireUser()`**, joining `requireAgent()` and `requireAdmin()`. Identity-scoped, not role-scoped: it is for endpoints whose `where` clause does the authorising.
  - `lib/ticket-access.ts`'s `Viewer` gains **`name`** on all three variants, sourced from the session with a `?? "Unknown user"` coalesce (`DefaultSession["user"]` types `name` as nullable). Additive — no existing field or call site changes.
  - `lib/notifications.ts` and `lib/audit.ts` → the client modules, following the `lib/users.ts` shape. `GET /api/notifications` returns **`{ notifications, unreadCount }`** in one response so the bell needs a single request for both the badge and the list.
- **Behaviour introduced by Story 06** — later stories must assume these semantics:
  - **Audit and notification writes are inside the mutation's transaction**, per the intake. The consequence is explicit and accepted: a failing log write rolls the ticket mutation back and the client sees a `500`. Do not "fix" this by moving the writes outside the transaction.
  - **Interactive transactions arrive in this repo with this story.** Before it there was one `$transaction`, in the array form; after it there are six. On SQLite an interactive transaction holds the write lock for its whole body, so every read that can happen before the transaction opens does.
  - **`PATCH /api/notifications/[id]` returns `404`, not `403`, for someone else's notification** — ownership sits inside the Prisma `where`, the same no-existence-oracle rule Story 05 established for tickets.
  - **`GET /api/notifications` returns `200` with an empty list for a CUSTOMER**, not a `403`. Nothing in this story writes a customer a notification; the portal has no bell.
  - **The bell polls on a 30 s `refetchInterval`**, against the comment thread's 8 s, with `refetchIntervalInBackground` left at its default `false`. Push is explicitly out of scope.
  - `components/ui/popover.tsx` is added via `npx shadcn@latest add popover --base radix --preset nova`, matching `components.json`'s `"style": "radix-nova"`. It must import from the unified `radix-ui` package, as `components/ui/button.tsx:3` does.
- **One migration.** `prisma/migrations/<timestamp>_add_audit_log_and_notification/` — two `CreateTable`s plus three `CreateIndex`es. **No existing column changes**; if the diff shows a `new_User` or `new_Ticket` redefinition, the schema edit was wrong.
- **Deferred out of Story 06:**
  - **Real-time push** for notifications (WebSocket/SSE) and **email / SMS delivery** — named in the intake's out-of-scope list.
  - **Notification preferences and settings**, and a bulk **`PATCH /api/notifications`** mark-all endpoint. "Mark all read" is a loop over the ≤ 20 loaded rows today.
  - **Audit export, retention, and pagination.** The endpoint returns the newest 100 rows and stops.
  - **Customer-facing notifications.** The portal gets no bell, and a `Notification` is never addressed to a CUSTOMER in this story.
  - **Audit rows for comments and for customer/user mutations.** `entityType` is a String precisely so a later story can log something other than a `Ticket` without a migration.
- **Still no automated test framework.** Stories 01–05 all deferred it and Story 06's intake does not ask for one either, so this ships a manual + `curl` test plan. `describeTicketChanges` and `assignmentNotifications` were written pure for the same reason `authorizeAssignmentChange` was — they join the highest-value first test suite in this repo.
