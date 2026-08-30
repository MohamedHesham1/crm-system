# Story 08 — Customer feedback, performance reporting, and a management dashboard

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)). Consumed, not re-implemented: `lib/prisma.ts`, `auth.ts`, `app/providers.tsx` (the single `SessionProvider` + `QueryClientProvider` — **do not add a second provider**), `lib/roles.ts`, `app/agent/layout.tsx`, `app/portal/layout.tsx`, `components/agent/sidebar-nav.tsx`.
- **Story 02 completed and committed** ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md)). Owns the `Customer` model and the `lib/customers.ts` client-module idiom that `lib/reports.ts` and `lib/feedback.ts` copy.
- **Story 03 completed and committed** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`). Owns `lib/api/http.ts` (`requireAdmin()` at `lib/api/http.ts:19–24`) and `lib/api/client.ts` (`ApiError`, `request<T>()`). **The admin-only agent-performance endpoint in this story is gated by `requireAdmin()`, not by hiding a component.**
- **Story 04 completed and committed** ([`../registration/04-story-customer-self-registration-with-automatic-account-linking.md`](../registration/04-story-customer-self-registration-with-automatic-account-linking.md), commit `cd32c28`). Established **`Customer.userId`** (`prisma/schema.prisma:50–51`) as the one and only answer to "whose profile is this?". Feedback ownership uses it via `resolveViewer()` and **must not** fall back to email matching.
- **Story 05 completed and committed** ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), commit `ee1482f`). Owns the `Ticket` model (`prisma/schema.prisma:59–94`), `lib/sla.ts`, `lib/ticket-access.ts`, and the ticket routes this story extends.
- **Story 06 completed and committed** ([`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md), commit `e148a5f`). Owns `requireUser()` (`lib/api/http.ts:32–40`) and `lib/activity.ts`. **This story writes no audit rows and no notifications** — see Edge Cases for why.
- **Story 07 completed and committed** ([`../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md`](../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md), commit `4a732d1`). This story copies its shape almost exactly: `lib/ticket-select.ts` (the shared-select module), `app/api/dashboard/route.ts` (the `requireUser()` + `isStaff` guard, the shared `now`, the `Promise.all`, the `groupBy` zero-fill), and `lib/dashboard.ts` (the composite-payload client module). **Read `app/api/dashboard/route.ts` end to end before writing `app/api/reports/route.ts`.**
- **Versions are pinned and must not move.** `next@16.3.3`, `react@19.2.8`, `react-dom@19.2.8`, `prisma@6.19.3`, `@prisma/client@6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`. **Do not run `npm install <pkg>@latest`** on anything already in `package.json`.
- **One new runtime dependency: `recharts`.** `package.json` has no charting library today. Install exactly `npm install recharts@^3.10.1` (latest is `3.10.1`; its `peerDependencies` accept `react@^19`, verified with `npm view recharts@3 peerDependencies`). **Do not install `recharts@2`** — its React peer range stops at 18.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — no `test`. `## Test Plan` below is manual + `curl`, matching Stories 01–07.

---

## Story Goal

Close the loop on a resolved ticket and turn the ticket table into numbers management can read:

1. **A `Feedback` model and one write path** — `POST /api/tickets/[id]/feedback`, callable **only by the customer who owns the ticket**, only when the ticket is `RESOLVED` or `CLOSED`, and only once. This is the single mutation in the story.
2. **A feedback prompt in the portal** on `app/portal/tickets/[id]` when the ticket is terminal and unrated; the submitted rating replaces the prompt in place.
3. **`GET /api/reports`** — staff-only, read-only: ticket counts by status and by priority, SLA performance (on-time-resolution rate and average resolution time), and the CSAT summary.
4. **`GET /api/reports/agents`** — **`requireAdmin()`-gated**, read-only: resolved count and average resolution time per agent. A separate route, not a field on `/api/reports`, so a plain AGENT calling it directly gets a **403** rather than a filtered payload.
5. **`app/agent/reports`** — one composed page rendering all four sections, with the agent-performance table mounted only for ADMIN.

**One deliberate deviation from the intake.** The intake says "Everything here reads existing data except the feedback submission itself." It also requires "% of tickets resolved within their `dueAt` target" and "average resolution time" — **neither is computable from the current schema**. There is no resolution timestamp on `Ticket` (`prisma/schema.prisma:59–94`), and `updatedAt` (line 86) is not one: it moves on every PATCH, including a status change made a week after resolution and including a priority edit on a closed ticket. So this story adds **one nullable column, `Ticket.resolvedAt`**, plus the two-line write that maintains it. It is additive, nullable, and backfilled; no existing response body loses a field. Recorded here so it is not later "reverted to spec".

**Not in scope** (from the intake): CSV/PDF export, scheduled or emailed report delivery, historical trend charts (every number here is point-in-time), feedback moderation or agent replies to feedback, and any survey beyond the single post-resolution rating. Also out of scope and **not** to be added: notifications or audit rows for feedback, a customer-visible view of aggregate CSAT, and date-range filters on the reports page.

---

## Context — Read These Files First

1. `app/api/dashboard/route.ts` — all 70 lines. **The template for `app/api/reports/route.ts`.** Lines 16–25: `requireUser()` then an explicit `isStaff(user.role)` check returning `403`, with the comment explaining why `requireAgent()` is not used. Line 29: **one `now` for all queries** — copy that discipline. Lines 33–49: the `Promise.all`. Lines 51–63: the `groupBy` **zero-fill** against `TICKET_STATUSES`. Your `byPriority` needs the identical treatment against `TICKET_PRIORITIES`.
2. `lib/dashboard.ts` — all 33 lines. The client-module shape `lib/reports.ts` copies: a composite payload type, a `*Keys` factory (26–29), and one `request<T>()` call on the whole payload (line 32) with **no destructuring**. Contrast `lib/audit.ts:21`, which destructures `{ logs }`.
3. `lib/sla.ts` — all 76 lines. `TERMINAL_STATUSES` (**line 4**) is the only list of clock-stopping statuses in the repo; the feedback route and the `resolvedAt` write both read it. `isSlaBreached` (32–39) and `slaBreachedWhere` (69–71) are the two projections of the breach rule — **this story adds no third**. `SLA_HOURS` (16–20) and `defaultDueAt` (22–24) are what makes `dueAt` non-null in practice.
4. `lib/ticket-access.ts` — all 104 lines. `Viewer` (5–20) and `resolveViewer()` (**28–53**). Read the doc comment at 18–27: **`Customer.userId` and nothing else**, no email fallback. The feedback route branches on `viewer.kind === "customer"`; `"staff"` and `"orphan"` are both refused. `ticketScopeWhere` (60–64) returns `{ customerId: "__none__" }` for an orphan — a clause that matches nothing.
5. `app/api/tickets/[id]/route.ts` — all 205 lines. **Lines 12–31**: `TICKET_DETAIL_SELECT`, duplicated verbatim at `app/api/tickets/[id]/reopen/route.ts:7–27`; task 3 moves it to `lib/ticket-select.ts`. **Lines 50–57**: the `resolveViewer()` + `viewer.kind !== "staff"` guard the feedback route inverts. **Lines 71–82**: the `current` pre-read. **Lines 106–115**: the closed-ticket 409. **Lines 117–121**: the `data` object task 4 extends with `resolvedAt`. **Lines 144–169**: the `$transaction` and the `P2025` catch.
6. `app/api/tickets/[id]/reopen/route.ts` — all 87 lines. Its own copy of `TICKET_DETAIL_SELECT` (7–27) disappears in task 3. **Line 54** sets `status: "OPEN"`; task 5 adds `resolvedAt: null` beside it.
7. `app/api/tickets/[id]/comments/route.ts` — all 78 lines. The closest precedent for the feedback route: `loadScopedTicket` (**15–26**) re-checks ownership on **every** call through `ticketScopeWhere`, and a ticket the viewer cannot see is a **`404`, not a `403`** (line 23). Copy that choice — a 403 confirms the ticket exists.
8. `lib/ticket-select.ts` — all 20 lines. `TICKET_LIST_SELECT` and the comment explaining why `as const` is load-bearing. Task 3 adds `TICKET_DETAIL_SELECT` beside it. Note the header comment: this file exists because **a `route.ts` may not export a non-handler**.
9. `lib/tickets.ts` — lines 15–45 and 59–64. `TicketListItem` (**`dueAt`/`createdAt` are ISO strings, not `Date`s**), `TicketDetail` (40–45) which task 11 extends with `feedback`, and the `ticketKeys` factory. `ticketKeys.detail(id)` (line 62) is what the feedback mutation invalidates.
10. `components/portal/tickets/portal-ticket-detail.tsx` — all 43 lines. The `useQuery` (10–13), the `isPending`/`isError` ladder (15–23), and the `<CommentThread />` at line 40. The feedback block goes **between the description block and `<CommentThread />`**.
11. `lib/api/http.ts` — all 61 lines. `requireAdmin()` (**19–24**) for `/api/reports/agents`; `requireUser()` (32–40) for `/api/reports`; `validationError()` (42–45); `readJson()` (52–60). The comment at 6–9 is the rule: **`middleware.ts` excludes `/api/**` from its matcher (`middleware.ts:37`), so every route handler guards itself.**
12. `app/api/admin/audit/route.ts` — all 29 lines. The `const denied = await requireAdmin(); if (denied) return denied` idiom (**8–9**) that `app/api/reports/agents/route.ts` copies verbatim.
13. `lib/validation/ticket.ts` — lines 8–12 (`TICKET_PRIORITIES`, `TICKET_STATUSES` and their types) and 74–80 (`createCommentSchema` — the shape `createFeedbackSchema` follows: trimmed, `.max()`, message strings ending in a full stop).
14. `lib/validation/notification.ts` — lines 3–8. The comment stating why String-backed enums live in `lib/validation/`, which is why the rating bounds live in `lib/validation/feedback.ts` and nowhere else.
15. `prisma/schema.prisma` — all 165 lines. **Lines 10–12**: SQLite has no Prisma `enum`. **Lines 46–51**: `Customer.userId`, nullable-on-purpose. **Lines 80–86**: `Ticket.dueAt` nullable, `updatedAt`. **Lines 96–115** (`Comment`) is the model shape `Feedback` copies; **lines 148–165** (`Notification`) shows the `Cascade`-vs-`Restrict` reasoning to follow.
16. `prisma/migrations/20260829180255_add_audit_log_and_notification/migration.sql` — all 32 lines. Exactly what a generated SQLite migration looks like: `CREATE TABLE`, inline `CONSTRAINT … FOREIGN KEY`, then `CREATE INDEX`. Task 2's migration must look like this **plus** an `ALTER TABLE` and a hand-added backfill `UPDATE`.
17. `components/agent/dashboard/summary-cards.tsx` — all 51 lines. The stat-tile markup (`Card size="sm"` + `CardDescription` + a `text-2xl font-semibold` number) that every tile in this story reuses. **Do not invent a second tile style.**
18. `components/agent/dashboard/dashboard-overview.tsx` — all 41 lines. The client-component wrapper: one `useQuery`, `staleTime: 0` with the comment explaining why (lines 13–19), then the loading / error / content ladder. `components/agent/reports/reports-overview.tsx` is this file with different children.
19. `components/agent/dashboard/assigned-ticket-list.tsx` — all 51 lines. The `Table`/`TableHeader`/`TableRow` markup the agent-performance table copies, including the `text-muted-foreground` cells and the empty-state paragraph at 8–12.
20. `components/agent/sidebar-nav.tsx` — all 51 lines. `BASE_LINKS` (10–14) gains one entry in task 13. `ADMIN_LINKS` (16–19) does **not** — `/agent/reports` is for every agent; only the table inside it is admin-only.
21. `app/agent/layout.tsx` and `app/agent/admin/layout.tsx` — 13 and 14 lines. The agent area redirects non-staff (not 403); `AdminLayout` redirects non-admins to `/agent`. **`app/agent/reports` is not under `admin/`**, so it inherits only the staff check — the admin narrowing happens in `requireAdmin()` on the data route.
22. `app/globals.css` — lines 21–25 and 70–74. `--chart-1` … `--chart-5` are already defined, and redefined for dark mode at 105–109. Charts use `var(--chart-1)`; **do not hardcode a hex colour and do not add new CSS variables.**
23. `app/providers.tsx` — lines 10–15. `defaultOptions.queries` is `{ staleTime: 30_000, refetchOnWindowFocus: false }`. Both report queries override it with `staleTime: 0`, for the same reason the dashboard does.
24. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — the handler-signature section. `app/api/reports/route.ts` takes **no** dynamic segment (no `RouteContext<…>`, no `await ctx.params`); `app/api/tickets/[id]/feedback/route.ts` does — it is `RouteContext<"/api/tickets/[id]/feedback">`.
25. Grep for `recharts` across `package.json`, `app/`, `components/`: **zero hits.** Nothing charts today; this story introduces the first one and every chart component it adds must start with `"use client"`.
26. Grep for `resolvedAt` across `prisma/`, `app/`, `lib/`: **zero hits.** After this story there are exactly four writers/readers: the schema, the migration, the PATCH write, and the reopen clear.

---

## Product rules (from story)

| Concern | Before (Story 07) | After (Story 08) |
|---|---|---|
| Customer feedback | No model, no route, no UI | `Feedback`, one per ticket, customer-owner-only, terminal-status-only |
| Resolution timestamp | None — only `updatedAt`, which any edit moves | **`Ticket.resolvedAt`**, nullable, set on the transition **into** `RESOLVED`/`CLOSED` and cleared on reopen |
| `TICKET_DETAIL_SELECT` | Duplicated in two route files | Single export in `lib/ticket-select.ts`, plus a `feedback` relation |
| `GET /api/tickets/[id]` body | No `feedback` key | `feedback: { rating, comment, createdAt } \| null` — **additive**, no field removed |
| Aggregate reporting | None | `GET /api/reports` (staff) and `GET /api/reports/agents` (**admin only, 403 for AGENT**) |
| Agent nav | Dashboard · Tickets · Customers (+ Admin · Audit) | **Reports** added to the base links, visible to every agent |
| Charts | No charting library | `recharts@^3.10.1`, client components only |

**Additive.** No Story 01–07 endpoint loses a field, changes a status code, or changes its authorisation. The only edits to existing files are: `prisma/schema.prisma` (one model, one column, one back-relation, one index), `lib/ticket-select.ts` (one added export), `app/api/tickets/[id]/route.ts` and `app/api/tickets/[id]/reopen/route.ts` (delete a duplicated const, maintain `resolvedAt`), `lib/tickets.ts` (one added field), `components/portal/tickets/portal-ticket-detail.tsx` (one block), `components/agent/sidebar-nav.tsx` (one link), `package.json` (one dependency).

---

## Backend Tasks

### 1 — `prisma/schema.prisma`: `Feedback`, and a real resolution timestamp

**File: `prisma/schema.prisma`**

Add `resolvedAt` to `Ticket` immediately after `dueAt` (currently lines 80–83), keeping the existing `createdAt`/`updatedAt` below it:

```prisma
  /// When the ticket first entered a terminal status. **Nullable and set once**:
  /// `updatedAt` (line 86) cannot serve here, because it moves on every later
  /// edit — a priority change on a closed ticket would silently restate when it
  /// was resolved. Written only by `PATCH /api/tickets/[id]` on a transition
  /// *into* `TERMINAL_STATUSES`, and cleared by the reopen action. There is no
  /// other writer.
  resolvedAt      DateTime?
```

Add the back-relation beside `comments` / `notifications` (currently lines 88–89):

```prisma
  feedback        Feedback?
```

Add an index for the reports query beside the existing `@@index` block (lines 91–93):

```prisma
  @@index([resolvedAt])
```

Append the new model after `Ticket` (i.e. before `model Comment` at line 98):

```prisma
/// One post-resolution rating from the customer who owns the ticket.
/// `ticketId` is `@unique`, which is what makes "one feedback per ticket" a
/// database guarantee and not just a handler check — two concurrent submissions
/// lose one to `P2002`, never to a duplicate row.
model Feedback {
  id        String   @id @default(cuid())

  ticketId  String   @unique
  /// `Cascade`, matching `Comment.ticket` (line 102): feedback on a deleted
  /// ticket is orphaned data, not history. Contrast `AuditLog`, which
  /// deliberately has no FK at all.
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  /// 1–5. An `Int`, bounded in application code by `createFeedbackSchema` in
  /// `lib/validation/feedback.ts` — SQLite enforces no range, exactly as it
  /// enforces no enum on `Ticket.status` (see line 10).
  rating    Int
  /// Optional per the acceptance criteria. An empty submitted comment is stored
  /// as NULL, never as `""`.
  comment   String?
  createdAt DateTime @default(now())
}
```

**No author column.** The author is `ticket.customer` by construction — the route refuses every caller who is not that customer, so a `userId` here would be a second, weaker copy of the same fact.

### 2 — The migration, with a backfill

Run:

```bash
npx prisma migrate dev --create-only --name add_feedback_and_ticket_resolved_at
```

Then **hand-append** the backfill to the generated `prisma/migrations/<timestamp>_add_feedback_and_ticket_resolved_at/migration.sql`, after the `ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" DATETIME;` line:

```sql
-- Backfill: tickets already terminal when this column landed have no recorded
-- resolution moment. `updatedAt` is the best available approximation and is
-- explicitly an approximation — it is the reason the reports page shows
-- averages, not per-ticket resolution times. Rows resolved after this migration
-- get an exact `resolvedAt` from the PATCH handler.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('RESOLVED', 'CLOSED');
```

Then apply it:

```bash
npx prisma migrate dev
```

Edit the file **before** the first apply. Prisma checksums a migration when it applies it; editing an applied migration marks the history as drifted and the next `migrate dev` offers a reset.

### 3 — `lib/ticket-select.ts`: one detail select, plus feedback

**File: `lib/ticket-select.ts`**

`TICKET_DETAIL_SELECT` currently exists **twice**, byte-identical, at `app/api/tickets/[id]/route.ts:12–31` and `app/api/tickets/[id]/reopen/route.ts:7–27`. Adding `feedback` to one and not the other is a bug waiting to happen, so it moves here first — the same move Story 07 made for `TICKET_LIST_SELECT`, for the same reason (a `route.ts` may not export a non-handler).

Append to the file, keeping `TICKET_LIST_SELECT` unchanged:

```ts
/**
 * The detail projection shared by `GET`/`PATCH /api/tickets/[id]` and
 * `POST /api/tickets/[id]/reopen`. Lifted out of those two route files, where
 * it lived twice, byte-identical.
 *
 * `feedback` is a nullable to-one relation, so it selects to
 * `{ rating, comment, createdAt } | null` with no extra query.
 */
export const TICKET_DETAIL_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  dueAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, email: true, company: true } },
  assignedAgent: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  },
  feedback: { select: { rating: true, comment: true, createdAt: true } },
} as const
```

**`resolvedAt` is deliberately not selected here.** It is an internal reporting column; nothing in the ticket UI renders it, and adding it to the detail payload would invite a second, per-ticket resolution-time display this story does not scope.

**File: `app/api/tickets/[id]/route.ts`** — delete lines 12–31 and import the const instead:

```ts
import { TICKET_DETAIL_SELECT } from "@/lib/ticket-select"
```

**File: `app/api/tickets/[id]/reopen/route.ts`** — delete lines 7–27 and add the same import. Both files' handler bodies are otherwise untouched by this task.

### 4 — `PATCH /api/tickets/[id]`: maintain `resolvedAt`

**File: `app/api/tickets/[id]/route.ts`**

Extend the existing `lib/sla` import (line 8):

```ts
import { isSlaBreached, TERMINAL_STATUSES } from "@/lib/sla"
```

Replace the `data` construction at **lines 117–121** with:

```ts
  const { dueAt, ...rest } = parsed.data
  const wasTerminal = TERMINAL_STATUSES.includes(current.status as TicketStatus)
  const willBeTerminal =
    parsed.data.status === undefined
      ? wasTerminal
      : TERMINAL_STATUSES.includes(parsed.data.status)

  const data = {
    ...rest,
    ...(dueAt === undefined ? {} : { dueAt: dueAt === null ? null : new Date(dueAt) }),
    // Only the *transition* writes. RESOLVED -> CLOSED leaves the original
    // moment alone (both are terminal), and a PATCH that touches only
    // `priority` never rewrites it. A terminal -> non-terminal move cannot
    // happen here for a CLOSED ticket (409 at line 106) but can for a RESOLVED
    // one, and that clears the stamp.
    ...(wasTerminal === willBeTerminal ? {} : { resolvedAt: willBeTerminal ? new Date() : null }),
  }
```

The `parsed.data.status === undefined ? wasTerminal : …` fallback is load-bearing — writing `false` there would clear `resolvedAt` on every PATCH that does not mention `status`.

**Do not** touch `describeTicketChanges` (123–132), the notification block (134–142), the transaction (144–161), or the `P2025` catch (164–169). `resolvedAt` earns **no audit row** — it is a derived timestamp of the `STATUS_CHANGED` entry `logActivity` already writes.

### 5 — `POST /api/tickets/[id]/reopen`: clear `resolvedAt`

**File: `app/api/tickets/[id]/reopen/route.ts`**

The handler only ever moves `CLOSED` → `OPEN` (the 409 at lines 47–49 guarantees it), so the clear is unconditional. Change **line 54**:

```ts
      data: { status: "OPEN", resolvedAt: null },
```

A reopened ticket that is resolved again gets a **new** `resolvedAt`, so the reports measure the most recent resolution. Stated explicitly because the alternative — keeping the first stamp — would make "average resolution time" shrink every time a ticket bounces.

### 6 — `lib/validation/feedback.ts`

**Create file: `lib/validation/feedback.ts`**

```ts
import { z } from "zod"

/**
 * The rating bounds live here and nowhere else, for the same reason
 * `TICKET_STATUSES` does (`lib/validation/ticket.ts:3–7`): SQLite constrains
 * nothing, so application code is the constraint. The UI renders its buttons
 * from `RATING_VALUES` rather than from a literal `[1, 2, 3, 4, 5]`.
 */
export const RATING_MIN = 1
export const RATING_MAX = 5
export const RATING_VALUES = [1, 2, 3, 4, 5] as const

export const createFeedbackSchema = z.object({
  rating: z
    .number()
    .int("Choose a whole-number rating.")
    .min(RATING_MIN, "Rating must be between 1 and 5.")
    .max(RATING_MAX, "Rating must be between 1 and 5."),
  /**
   * Optional and trimmed. The route stores `""` as `null` — a row whose comment
   * is an empty string and a row with no comment must not be two states.
   */
  comment: z
    .string()
    .trim()
    .max(2_000, "Comment must be 2,000 characters or fewer.")
    .optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
```

### 7 — `POST /api/tickets/[id]/feedback`

**Create file: `app/api/tickets/[id]/feedback/route.ts`**

The only mutation in this story. Four gates, in order: **who you are**, **whether the ticket is yours**, **whether it is finished**, **whether you already rated it**.

```ts
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError } from "@/lib/api/http"
import { TERMINAL_STATUSES } from "@/lib/sla"
import { resolveViewer } from "@/lib/ticket-access"
import type { TicketStatus } from "@/lib/validation/ticket"
import { createFeedbackSchema } from "@/lib/validation/feedback"

const FEEDBACK_SELECT = { rating: true, comment: true, createdAt: true } as const

export async function POST(request: Request, ctx: RouteContext<"/api/tickets/[id]/feedback">) {
  const resolved = await resolveViewer()
  if (!resolved.ok) return resolved.response
  const { viewer } = resolved

  // The inverse of `PATCH /api/tickets/[id]` (line 55): staff are refused here.
  // An `orphan` — a CUSTOMER login with no linked `Customer` row
  // (`lib/ticket-access.ts:12–20`) — is refused too, and is never resolved by
  // email. Ownership is `Customer.userId` or nothing.
  if (viewer.kind !== "customer") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  // Scoped by `customerId`, so a ticket belonging to someone else is a **404**,
  // not a 403 — the same choice `loadScopedTicket` makes at
  // `app/api/tickets/[id]/comments/route.ts:23`. A 403 confirms the id exists.
  const ticket = await prisma.ticket.findFirst({
    where: { id, customerId: viewer.customerId },
    select: { id: true, status: true, feedback: { select: { id: true } } },
  })
  if (!ticket) return notFound("Ticket not found.")

  if (!TERMINAL_STATUSES.includes(ticket.status as TicketStatus)) {
    return Response.json(
      { error: "You can rate this ticket once it has been resolved." },
      { status: 409 },
    )
  }

  if (ticket.feedback) {
    return Response.json({ error: "You have already rated this ticket." }, { status: 409 })
  }

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createFeedbackSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const comment = parsed.data.comment?.length ? parsed.data.comment : null

  try {
    const feedback = await prisma.feedback.create({
      data: { ticketId: id, rating: parsed.data.rating, comment },
      select: FEEDBACK_SELECT,
    })
    return Response.json({ feedback }, { status: 201 })
  } catch (error) {
    // The `@unique` on `ticketId` is the real guarantee; the check above is the
    // friendly path. Two submissions racing land here, and the loser gets the
    // same 409 it would have got a millisecond earlier.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "You have already rated this ticket." }, { status: 409 })
    }
    throw error
  }
}
```

**No `GET`.** Existing feedback reaches the client on the ticket detail payload via `TICKET_DETAIL_SELECT` (task 3). A second read path would be a second thing to keep in sync.

**No `logActivity` and no `notify`.** `AuditLog` is the trail of *ticket mutations* (`prisma/schema.prisma:117–118`) and feedback mutates no ticket field; notifying the assignee of a rating is a product decision the intake does not make. Both are deliberate omissions — do not add them "for consistency".

### 8 — `lib/report-metrics.ts`: the pure aggregation

**Create file: `lib/report-metrics.ts`**

Server-side helpers with no Prisma import and no `Request` — the same "pure module" discipline as `describeTicketChanges` in `lib/activity.ts:77–127`, so the arithmetic is reviewable without a database.

Prisma cannot average a *difference between two columns*, and SQLite offers no aggregate for it, so resolution timing is computed in TypeScript over one `findMany` of resolved rows.

```ts
/** One resolved ticket, as selected by `app/api/reports/route.ts`. */
export type ResolvedTicketRow = {
  createdAt: Date
  resolvedAt: Date
  dueAt: Date | null
  assignedAgentId: string | null
}

export type SlaSummary = {
  /** Resolved tickets that had a `dueAt` to be measured against. */
  measured: number
  /** Of those, the ones finished at or before `dueAt`. */
  onTime: number
  /** `onTime / measured`, or `null` when nothing is measurable. **Not zero** — "no data" and "0%" are different answers. */
  onTimeRate: number | null
  /** Mean `resolvedAt - createdAt` in milliseconds across **all** resolved tickets, `dueAt` or not. `null` when there are none. */
  averageResolutionMs: number | null
  /** Total resolved tickets — the denominator of `averageResolutionMs`. */
  resolved: number
}

export function summariseSla(rows: ResolvedTicketRow[]): SlaSummary {
  const measurable = rows.filter((row) => row.dueAt !== null)
  const onTime = measurable.filter((row) => row.resolvedAt.getTime() <= row.dueAt!.getTime()).length

  return {
    measured: measurable.length,
    onTime,
    onTimeRate: measurable.length === 0 ? null : onTime / measurable.length,
    averageResolutionMs: averageResolutionMs(rows),
    resolved: rows.length,
  }
}

export type AgentPerformanceRow = {
  agentId: string | null
  resolved: number
  averageResolutionMs: number | null
  onTime: number
  measured: number
}

/**
 * Groups the same rows by `assignedAgentId`. **`null` is a real bucket** — a
 * ticket resolved while unassigned is not dropped, because dropping it would
 * make the per-agent counts fail to sum to the total and nobody would know why.
 * The caller maps ids to names and labels `null` as "Unassigned".
 */
export function summariseAgents(rows: ResolvedTicketRow[]): AgentPerformanceRow[] {
  const buckets = new Map<string | null, ResolvedTicketRow[]>()

  for (const row of rows) {
    const existing = buckets.get(row.assignedAgentId)
    if (existing) existing.push(row)
    else buckets.set(row.assignedAgentId, [row])
  }

  return [...buckets].map(([agentId, group]) => {
    const measurable = group.filter((row) => row.dueAt !== null)
    return {
      agentId,
      resolved: group.length,
      averageResolutionMs: averageResolutionMs(group),
      onTime: measurable.filter((row) => row.resolvedAt.getTime() <= row.dueAt!.getTime()).length,
      measured: measurable.length,
    }
  })
}

function averageResolutionMs(rows: ResolvedTicketRow[]): number | null {
  if (rows.length === 0) return null
  const total = rows.reduce(
    (sum, row) => sum + (row.resolvedAt.getTime() - row.createdAt.getTime()),
    0,
  )
  return total / rows.length
}

/** "2 d 4 h", "3 h 12 m", "48 m", or "—" for `null`. The one duration formatter. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${minutes % 60} m`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}
```

`formatDuration` is imported by client components, so this module must stay free of `@/lib/prisma` — `npm run build` is what catches a violation.

### 9 — `GET /api/reports`

**Create file: `app/api/reports/route.ts`**

Structurally `app/api/dashboard/route.ts` with different queries. **No agent breakdown lives here** — see task 10.

```ts
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api/http"
import { isStaff } from "@/lib/roles"
import { TERMINAL_STATUSES } from "@/lib/sla"
import { summariseSla } from "@/lib/report-metrics"
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/validation/ticket"

export async function GET() {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response

  // Same reasoning as `app/api/dashboard/route.ts:20–25`: `requireAgent()` would
  // do here (no caller identity is needed), but keeping both staff read
  // endpoints on one idiom is worth more than saving a line. A CUSTOMER gets a
  // 403 — there is no customer-shaped reading of internal performance.
  if (!isStaff(resolved.user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const [byStatusRows, byPriorityRows, resolvedRows, csat, ratingRows] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, dueAt: true, assignedAgentId: true },
    }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.feedback.groupBy({ by: ["rating"], _count: { _all: true } }),
  ])

  const byStatus = zeroFill(TICKET_STATUSES, byStatusRows, "status")
  const byPriority = zeroFill(TICKET_PRIORITIES, byPriorityRows, "priority")

  // `resolvedAt: { not: null }` narrows the value in SQL but not in the type —
  // Prisma still types the column `Date | null`. This assertion is the one place
  // that gap is bridged; `summariseSla` then takes a non-null `resolvedAt` and
  // stays honest about what it is averaging.
  const sla = summariseSla(resolvedRows.map((row) => ({ ...row, resolvedAt: row.resolvedAt! })))

  const distribution = Object.fromEntries(
    RATING_VALUES.map((rating) => [rating, 0]),
  ) as Record<number, number>
  for (const row of ratingRows) distribution[row.rating] = row._count._all

  return Response.json({
    tickets: {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      byPriority,
    },
    sla,
    csat: {
      // `_avg` is `null` on an empty table, and that is the correct answer —
      // do not coalesce it to 0, which reads as "everyone hated us".
      average: csat._avg.rating,
      count: csat._count._all,
      distribution,
    },
    terminalStatuses: TERMINAL_STATUSES,
  })
}
```

Import `RATING_VALUES` from `@/lib/validation/feedback`, and write `zeroFill` as a local helper in this file, generic over the allowed tuple and the `groupBy` key. Mirror the inline loop at `app/api/dashboard/route.ts:51–61` **including its `includes` guard**, which skips a status/priority string outside the allowed tuple so a corrupt row lands in no bucket rather than inventing one.

`terminalStatuses` is echoed so the page can label the SLA card ("resolved or closed") without re-spelling the list.

### 10 — `GET /api/reports/agents` (admin only)

**Create file: `app/api/reports/agents/route.ts`**

A separate route, and this is the point of the intake's technical hint: **a regular AGENT hitting this URL directly gets a 403**, not a filtered payload and not a rendered-but-hidden section.

```ts
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/api/http"
import { summariseAgents } from "@/lib/report-metrics"

export async function GET() {
  // Same two lines as `app/api/admin/audit/route.ts:8–9`. `middleware.ts`
  // excludes `/api/**` (matcher, line 37), so this is the only thing standing
  // between a plain AGENT and a per-agent leaderboard.
  const denied = await requireAdmin()
  if (denied) return denied

  const [rows, staff] = await Promise.all([
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, dueAt: true, assignedAgentId: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["AGENT", "ADMIN"] } },
      select: { id: true, name: true },
    }),
  ])

  const names = new Map(staff.map((user) => [user.id, user.name]))

  const agents = summariseAgents(rows.map((row) => ({ ...row, resolvedAt: row.resolvedAt! })))
    .map((agent) => ({
      ...agent,
      // `Ticket.assignedAgent` is `onDelete: SetNull` (`prisma/schema.prisma:78`),
      // so a deleted agent's tickets return to the queue and land in the `null`
      // bucket. An id with no name is therefore a genuinely missing row; fall
      // back to the id so it stays traceable instead of silently vanishing.
      name: agent.agentId === null ? "Unassigned" : (names.get(agent.agentId) ?? agent.agentId),
    }))
    .sort((a, b) => b.resolved - a.resolved)

  return Response.json({ agents })
}
```

**Note the route path.** It is `/api/reports/agents`, not `/api/admin/reports` — `/api/admin/**` is Story 03's convention for *administration screens*, and this is a report section. The guard, not the URL, is what enforces the rule.

---

## Frontend Tasks

### 11 — `lib/feedback.ts`, `lib/reports.ts`, and the `TicketDetail` type

**Create file: `lib/feedback.ts`**

```ts
import { request } from "@/lib/api/client"
import type { CreateFeedbackInput } from "@/lib/validation/feedback"

/** `createdAt` arrives as an ISO **string** — `Response.json` serialises it. */
export type TicketFeedback = {
  rating: number
  comment: string | null
  createdAt: string
}

export async function postFeedback(
  ticketId: string,
  input: CreateFeedbackInput,
): Promise<TicketFeedback> {
  const { feedback } = await request<{ feedback: TicketFeedback }>(
    `/api/tickets/${ticketId}/feedback`,
    { method: "POST", body: JSON.stringify(input) },
  )
  return feedback
}
```

No `*Keys` factory: feedback has no list endpoint of its own, and the cache entry it invalidates is `ticketKeys.detail(id)` (`lib/tickets.ts:62`).

**Create file: `lib/reports.ts`**

Composite payload plus keys, exactly like `lib/dashboard.ts:13–33`:

```ts
import { request } from "@/lib/api/client"
import type { SlaSummary } from "@/lib/report-metrics"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

export type ReportSummary = {
  tickets: {
    total: number
    byStatus: Record<TicketStatus, number>
    byPriority: Record<TicketPriority, number>
  }
  sla: SlaSummary
  csat: {
    /** `null` when no feedback exists — render "No ratings yet", not "0.0". */
    average: number | null
    count: number
    distribution: Record<number, number>
  }
  terminalStatuses: readonly TicketStatus[]
}

export type AgentPerformance = {
  agentId: string | null
  name: string
  resolved: number
  averageResolutionMs: number | null
  onTime: number
  measured: number
}

export const reportKeys = {
  all: ["reports"] as const,
  summary: () => [...reportKeys.all, "summary"] as const,
  agents: () => [...reportKeys.all, "agents"] as const,
}

export async function fetchReportSummary(): Promise<ReportSummary> {
  return request<ReportSummary>("/api/reports")
}

export async function fetchAgentPerformance(): Promise<AgentPerformance[]> {
  const { agents } = await request<{ agents: AgentPerformance[] }>("/api/reports/agents")
  return agents
}
```

`SlaSummary` is imported **as a type only** from `lib/report-metrics.ts`; that module has no Prisma import (task 8), so this is safe in a client bundle.

**File: `lib/tickets.ts`** — extend `TicketDetail` (currently lines 40–45) with one field and add `import type { TicketFeedback } from "@/lib/feedback"` at the top:

```ts
  /** `null` until the owning customer rates the ticket. On the shared detail payload, so agents see it too — it is not a portal-only field. */
  feedback: TicketFeedback | null
```

Nothing else in the file changes.

### 12 — The portal feedback prompt

**Create file: `components/portal/tickets/feedback-form.tsx`**

A client component (`"use client"`) that renders one of two things: the submitted rating, or the prompt.

- Props: `{ ticketId: string; feedback: TicketFeedback | null }`.
- When `feedback !== null`: a `Card size="sm"` reading `You rated this ticket {feedback.rating}/5`, plus the comment in a `whitespace-pre-wrap` paragraph when present. **No edit control** — one feedback per ticket is a database guarantee, and an edit button that always 409s is worse than no button.
- Otherwise: a heading "How did we do?", five rating buttons built from `RATING_VALUES` (`lib/validation/feedback.ts`), an optional `<Textarea>` for the comment, and a submit `<Button>` disabled until a rating is chosen and while `isPending`.
- `useMutation({ mutationFn: (input: CreateFeedbackInput) => postFeedback(ticketId, input) })` with `onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) })` — the same invalidate-the-detail pattern `components/agent/tickets/comment-thread.tsx` uses after posting a comment.
- On error render the message in `<p role="alert" className="text-sm text-destructive">`, matching `components/portal/tickets/portal-ticket-detail.tsx:18–22`. `ApiError.message` already carries the server's text, so a `409` reads "You have already rated this ticket."

Use the existing `Button`, `Card`, `Textarea` and `Label` from `components/ui/` — **no new shadcn component is needed and none should be added.**

**File: `components/portal/tickets/portal-ticket-detail.tsx`** — between the description block (ends line 38) and `<CommentThread />` (line 40), insert:

```tsx
      {TERMINAL_STATUSES.includes(data.status) ? (
        <FeedbackForm ticketId={ticketId} feedback={data.feedback} />
      ) : null}
```

with `import { TERMINAL_STATUSES } from "@/lib/sla"` added. **The "is it finished?" test is `TERMINAL_STATUSES`, not a literal `["RESOLVED", "CLOSED"]`** — that list has exactly one home (`lib/sla.ts:4`) and this story does not open a second. `lib/sla.ts` imports only types, so it is safe in a client component.

The prompt is **not** added to the agent-side `components/agent/tickets/ticket-detail.tsx`; an agent cannot submit (the route 403s them). Rendering the *submitted* rating there is a reasonable follow-up and is **out of scope** here.

### 13 — `app/agent/reports` and the nav

**Create file: `app/agent/reports/page.tsx`**

A server component following `app/agent/tickets/page.tsx:6–18`: heading here, data in the client child. It reads the session only to decide whether to mount the admin section.

```tsx
import { auth } from "@/auth"

import { ReportsOverview } from "@/components/agent/reports/reports-overview"

export default async function ReportsPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      {/* Cosmetic only. The real gate is `requireAdmin()` in
          `app/api/reports/agents/route.ts` — an AGENT who forces this prop true
          in devtools still gets a 403 from the endpoint. */}
      <ReportsOverview isAdmin={session?.user.role === "ADMIN"} />
    </div>
  )
}
```

**File: `components/agent/sidebar-nav.tsx`** — add to `BASE_LINKS` (lines 10–14), after Tickets:

```ts
  { href: "/agent/reports", label: "Reports" },
```

**Not** to `ADMIN_LINKS`: the page is for every agent. The active check at line 31 uses `startsWith` for non-`/agent` hrefs, so `/agent/reports` highlights correctly with no further change.

### 14 — The report components

**Create file: `components/agent/reports/reports-overview.tsx`**

`"use client"`. The `components/agent/dashboard/dashboard-overview.tsx` ladder with different children:

- `useQuery({ queryKey: reportKeys.summary(), queryFn: fetchReportSummary, staleTime: 0 })` — `staleTime: 0` for the same reason as `dashboard-overview.tsx:13–19`: the provider default (`app/providers.tsx:12`) would serve half-minute-old numbers to someone who just resolved a ticket. **No `refetchInterval`** — this is a report, not a monitor.
- `isPending` → `<p className="text-sm text-muted-foreground">Loading reports…</p>`; `isError` → the `role="alert"` paragraph.
- On success, in order: `<TicketBreakdownCharts …>`, `<SlaSummaryCards …>`, `<CsatSummary …>`, then `{isAdmin ? <AgentPerformanceTable /> : null}`.

**Create file: `components/agent/reports/ticket-breakdown-charts.tsx`**

`"use client"`. Two `recharts` bar charts side by side (`grid gap-4 lg:grid-cols-2`), each inside a `Card`:

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
```

- Build the data by mapping the **tuple**, not `Object.entries`: `TICKET_STATUSES.map((status) => ({ label: status, count: byStatus[status] }))`, and the same over `TICKET_PRIORITIES`. That fixes the bar order at `OPEN → IN_PROGRESS → RESOLVED → CLOSED` and `LOW → MEDIUM → HIGH` instead of leaving it insertion-ordered.
- `<ResponsiveContainer width="100%" height={240}>` — recharts measures its parent, and a chart inside an unsized `Card` renders 0 px tall. The explicit height is required, not stylistic.
- `<Bar dataKey="count" fill="var(--chart-1)" radius={4} />`. Colours come from `app/globals.css:70–74`, already redefined for dark mode at 105–109. **Do not hardcode hex values.**
- `<YAxis allowDecimals={false} />` — counts are integers and recharts will otherwise label ticks `0.5`.

**Create file: `components/agent/reports/sla-summary.tsx`**

`Card size="sm"` tiles matching `components/agent/dashboard/summary-cards.tsx:53–62`:

- **On-time resolution** — `onTimeRate === null ? "—" : Math.round(onTimeRate * 100) + "%"`, with a `CardDescription` reading `{onTime} of {measured} tickets with an SLA target`.
- **Average resolution time** — `formatDuration(averageResolutionMs)` from `lib/report-metrics.ts`, described as `across {resolved} resolved tickets`.
- **Resolved** — the raw `resolved` count, described with the `terminalStatuses` list ("resolved or closed").

Render `—` for a `null`, never `0%` or `0 m`. "Nothing measurable" and "nothing on time" are different facts and the page must not conflate them.

**Create file: `components/agent/reports/csat-summary.tsx`**

- A tile showing `average === null ? "No ratings yet" : average.toFixed(1)` with `out of 5 · {count} responses`.
- The 1–5 distribution as five inline rows built from `RATING_VALUES` (or a small `recharts` bar chart — either is fine). Reuse the card/tile markup rather than inventing a third style.

**Create file: `components/agent/reports/agent-performance-table.tsx`**

`"use client"`, with its **own** `useQuery({ queryKey: reportKeys.agents(), queryFn: fetchAgentPerformance, staleTime: 0 })`, so the admin data is a separate request against the separately-guarded endpoint.

- Columns: Agent · Resolved · Avg. resolution · On time. Markup copied from `components/agent/dashboard/assigned-ticket-list.tsx:14–49`.
- `Avg. resolution` uses `formatDuration`; `On time` is `measured === 0 ? "—" : onTime + "/" + measured`.
- Empty state: `<p className="text-sm text-muted-foreground">No tickets have been resolved yet.</p>`, matching `assigned-ticket-list.tsx:8–12`.
- On error, render the message. **Do not swallow a 403 into an empty table** — if this ever renders for a non-admin, the failure must be visible, not indistinguishable from "no data".

---

## Edge Cases & Failure Modes

- **A staff member POSTing feedback.** `403` at the `viewer.kind !== "customer"` guard (task 7) — the exact inverse of `PATCH /api/tickets/[id]:55`. An agent cannot rate a ticket on a customer's behalf, and there is no admin override.
- **An `orphan` viewer** — a CUSTOMER login with no linked `Customer` row (`lib/ticket-access.ts:12–20`). Same `403`. There is **no email fallback**; Story 04 made `Customer.userId` the only ownership answer and a second one would be a security bug.
- **A customer rating someone else's ticket.** `findFirst` is scoped by `customerId`, so it returns nothing and the response is **`404 "Ticket not found."`** — not `403`. Matching `app/api/tickets/[id]/comments/route.ts:23`; a 403 would confirm the id exists.
- **Rating an `OPEN` or `IN_PROGRESS` ticket.** `409` with "You can rate this ticket once it has been resolved." The test reads `TERMINAL_STATUSES` (`lib/sla.ts:4`), so it stays correct if that list ever changes.
- **A second submission on the same ticket.** `409` from the pre-check; a **concurrent** second submission gets the same `409` from the `P2002` catch, because `Feedback.ticketId` is `@unique`. The handler check is the friendly path, the constraint is the guarantee. Test Plan item 6.
- **`rating: 0`, `6`, `2.5`, or `"5"`.** All rejected by `createFeedbackSchema` with `400` and `fieldErrors.rating`. `z.number()` does not coerce, so the string `"5"` fails — the client must send a real number. Test Plan item 5.
- **An empty comment.** `""` trims to `""`, `parsed.data.comment?.length` is falsy, and the column stores **`null`**. An empty string and no comment must never be two distinguishable states.
- **A ticket rated, then reopened, then resolved again.** The `Feedback` row survives (nothing deletes it) and `resolvedAt` is **overwritten** with the second resolution. So the reports measure the latest resolution while CSAT reflects the first rating, and the portal shows the existing rating rather than re-prompting. Accepted: re-prompting needs a feedback-per-resolution model, which the intake's one-per-ticket `@unique` explicitly rules out.
- **A ticket deleted after being rated.** `DELETE /api/tickets/[id]` exists (`app/api/tickets/[id]/route.ts:172`). `Feedback.ticket` is `onDelete: Cascade`, so the row goes with it and CSAT drops. Deliberate, and the opposite of `AuditLog`, which has no FK precisely so deletions stay on record (`prisma/schema.prisma:121–127`).
- **`resolvedAt` on tickets that were already terminal before this story.** Backfilled from `updatedAt` by task 2's `UPDATE`, which is an **approximation** — a closed ticket edited last week reports a resolution time stretching to last week. It skews `averageResolutionMs` and the on-time rate on legacy rows only; every ticket resolved after the migration is exact. Say so in the PR description. Do **not** try to reconstruct the truth from `AuditLog.detail` free text — `prisma/schema.prisma:135–137` calls that field a human-readable summary, and parsing it is exactly the anti-pattern that comment warns against.
- **`RESOLVED → CLOSED`.** Both are terminal, so `wasTerminal === willBeTerminal` and `resolvedAt` is **not** rewritten (task 4). Without that guard, closing a month-old resolved ticket would restate it as resolved today. Test Plan item 9.
- **A PATCH that touches only `priority` on a resolved ticket.** `parsed.data.status === undefined`, so `willBeTerminal` falls back to `wasTerminal`, the spread contributes nothing, and `resolvedAt` is untouched. This is why the fallback is `wasTerminal` and not `false`.
- **`CLOSED → OPEN` via PATCH.** Impossible — the 409 at `app/api/tickets/[id]/route.ts:106–115` blocks it, and reopening goes through `POST /api/tickets/[id]/reopen`, which clears `resolvedAt` (task 5). `RESOLVED → OPEN` **is** allowed through PATCH, and clears it.
- **A ticket resolved with `dueAt: null`.** Counts toward `resolved` and `averageResolutionMs` but **not** toward `measured`, so it can never be "late". `dueAt` is nullable by design (`prisma/schema.prisma:80–83`) and a ticket with no target cannot miss one. This is why `onTimeRate` has its own denominator.
- **No resolved tickets at all.** `summariseSla` returns `onTimeRate: null` and `averageResolutionMs: null`; the UI renders `—`. **Never `0%`.** Test Plan item 12.
- **No feedback at all.** `_avg.rating` is `null` from Prisma on an empty table and is passed through unchanged. Do **not** coalesce to `0` — a 0.0 CSAT reads as universal dissatisfaction.
- **A rating outside 1–5 already in the database.** Only reachable by direct SQL. It lands in `distribution` under a key the UI does not render (the UI iterates `RATING_VALUES`) but it *does* move `_avg`. Accepted; a `CHECK` constraint Prisma will not manage is not worth adding for it.
- **A plain AGENT calling `GET /api/reports/agents`.** `403` from `requireAdmin()` (`lib/api/http.ts:19–24`). This is the story's central authorisation requirement — the section is **not** merely hidden. `middleware.ts` excludes `/api/**` (matcher, line 37), so this guard is the only thing enforcing it. Test Plan item 14.
- **A CUSTOMER calling `GET /api/reports`.** `403`, matching `GET /api/dashboard` (`app/api/dashboard/route.ts:25`) rather than `GET /api/notifications`, which returns an empty `200`. There is no customer-shaped version of internal performance.
- **`resolvedRows` is unbounded.** Both report routes load every resolved ticket to average a duration, because Prisma cannot average a difference of two columns and SQLite offers no aggregate for it. Fine at this project's scale, with `@@index([resolvedAt])` (task 1) keeping the scan narrow. **When it stops being fine, replace it with one `$queryRaw` computing `AVG(julianday(resolvedAt) - julianday(createdAt))` — do not paginate it, which would silently bias the average.**
- **The five queries in `/api/reports` are not in a transaction.** Same reasoning as `app/api/dashboard/route.ts:27–29`: a ticket resolved mid-request can be counted in one number and not the next. A read-only report does not justify holding SQLite's write lock. **Do not "fix" this with `$transaction`.**
- **A `status` or `priority` string outside the allowed tuples.** Both columns are `String` (`prisma/schema.prisma:67–69`); the `includes` guard in `zeroFill` skips the row, so it lands in no bar and under-counts `tickets.total`. Identical to `app/api/dashboard/route.ts`'s handling, and deliberate — inventing a bar for a corrupt value is worse.
- **A recharts chart rendering 0 px tall.** `ResponsiveContainer` measures its parent; inside a `Card` with no height it collapses to nothing. Always give it `height={240}` explicitly. This is the most likely visual bug in the story.
- **`recharts` imported into a server component.** It uses browser APIs and hooks; the `"use client"` directive on every chart file is required, and `npm run build` — not `npm run dev` — is what surfaces a miss. Verification step 6.
- **`lib/report-metrics.ts` growing a Prisma import.** It is imported by client components for `formatDuration`. A `@/lib/prisma` import there pulls the Prisma client into the browser bundle and fails at `npm run build`. Keep it pure.
- **`TicketDetail` and `TICKET_DETAIL_SELECT` drifting.** They are hand-kept in sync across `lib/tickets.ts:40–46` and `lib/ticket-select.ts` — TypeScript cannot see across the JSON boundary, so a mismatch is a runtime `undefined`, not a compile error. Task 3 removes the *second copy of the select*; the type still needs eyes. Test Plan item 2.

---

## Test Plan

No test runner is installed (`package.json` has no `test` script), so these are manual and `curl`, matching Stories 01–07. Sign in with the seeded accounts from `prisma/seed.ts` (`agent@crm.local`, `customer@crm.local`, password `Passw0rd!`) plus an ADMIN account created at `/agent/admin/users/new`.

1. **Migration applies cleanly.** `npx prisma migrate status` reports no pending migration. `npx prisma studio` shows a `Feedback` table and a `resolvedAt` column on `Ticket`. Every pre-existing `RESOLVED`/`CLOSED` ticket has a non-null `resolvedAt` equal to its `updatedAt`; every live ticket has `null`.
2. **Detail-select refactor changed nothing.** `curl -s -b cookies.txt http://localhost:3000/api/tickets/<id> | jq '.ticket | keys'` before and after task 3: identical, **plus** `feedback`. `grep -rn "TICKET_DETAIL_SELECT" app/ lib/` returns two import lines and exactly one declaration, in `lib/ticket-select.ts`.
3. **Feedback happy path.** As the seeded customer, open a `RESOLVED` ticket at `/portal/tickets/<id>`. The prompt appears; submit `4` with a comment. The block flips to "You rated this ticket 4/5" **without a page reload** (the `ticketKeys.detail` invalidation), and the prompt does not return on refresh.
4. **Authorization matrix for `POST /api/tickets/<id>/feedback`:** no cookie → `401`; AGENT cookie → `403`; ADMIN cookie → `403`; a **different** customer's cookie → `404`; the owning customer on an `OPEN` ticket → `409`; the owning customer on a `RESOLVED` ticket → `201`.
5. **Validation.** `curl -X POST … -d '{"rating":6}'` → `400` with `fieldErrors.rating`. Repeat with `0`, `2.5`, `"5"` and `{}` — all `400`. `{"rating":5,"comment":"   "}` → `201` with `comment: null` in the row.
6. **Double submission.** POST twice → the second is `409 "You have already rated this ticket."` Then run two POSTs concurrently against an unrated ticket (`curl … & curl … & wait`): exactly one `201`, one `409`, and **one** row in `Feedback` — the `P2002` path.
7. **The prompt is status-gated.** On an `OPEN` ticket the portal shows **no** feedback block at all. PATCH it to `RESOLVED` as an agent, reload the portal page: the prompt appears.
8. **`resolvedAt` is written on transition.** PATCH a live ticket to `RESOLVED`; `npx prisma studio` shows `resolvedAt` ≈ now. PATCH another live ticket straight to `CLOSED`: same.
9. **`RESOLVED → CLOSED` does not rewrite it.** Note `resolvedAt` on a resolved ticket, wait a minute, PATCH it to `CLOSED`. **`resolvedAt` is unchanged.** This is the task-4 guard; it fails if `willBeTerminal` was written as a plain `TERMINAL_STATUSES.includes(parsed.data.status)`.
10. **A non-status PATCH does not touch it.** PATCH `{"priority":"HIGH"}` on a resolved ticket → `resolvedAt` unchanged, `updatedAt` moves. This pair is exactly what proves `updatedAt` could not have served as the resolution stamp.
11. **Reopen clears it.** `POST /api/tickets/<id>/reopen` on a closed ticket → `resolvedAt` is `null` and the ticket leaves the resolved counts in `/api/reports`. Resolve it again → a **new** `resolvedAt`.
12. **Empty-data states.** On a fresh database (`cp prisma/dev.db prisma/dev.db.story07.bak` first, then `rm prisma/dev.db && npx prisma migrate dev && npm run seed`), `/agent/reports` renders: charts with all-zero bars, on-time and average resolution as **`—`** (not `0%`, not `0 m`), and "No ratings yet". No crash, no `NaN`, no `undefined`.
13. **Numbers agree with the ticket list.** `curl -s -b cookies.txt http://localhost:3000/api/reports | jq .tickets.byStatus` matches the row counts from filtering `/agent/tickets` by each status. `tickets.total` equals the total row count.
14. **Admin gate on `GET /api/reports/agents`:** no cookie → `401`; CUSTOMER cookie → `403`; **AGENT cookie → `403`**; ADMIN cookie → `200`. The AGENT case is the acceptance criterion's "not just visually hidden" and must not be skipped.
15. **The section is gated in the UI too.** As a plain AGENT, `/agent/reports` renders the charts, SLA and CSAT sections and **no** agent-performance table. As an ADMIN, the table renders one row per agent who has resolved something, sorted by resolved count descending.
16. **Unassigned resolutions are not dropped.** Resolve a ticket that has `assignedAgentId: null` (an admin can set the status without claiming). It appears in the admin table as **"Unassigned"**, and the per-agent `resolved` values still sum to `sla.resolved` from `/api/reports`.
17. **On-time maths.** Create two tickets. Resolve one before its `dueAt`, and one after (PATCH `dueAt` into the past first). `sla.measured` is `2`, `sla.onTime` is `1`, `onTimeRate` is `0.5`, and the tile reads `50%`.
18. **A `dueAt: null` ticket.** PATCH a ticket's `dueAt` to `null`, then resolve it: `sla.resolved` increments, `sla.measured` does **not**, and `onTimeRate` is unchanged.
19. **CSAT maths.** Submit ratings of `5`, `4` and `2` on three tickets. `csat.average` is `3.666…`, the tile reads `3.7`, `csat.count` is `3`, and `distribution` is `{"1":0,"2":1,"3":0,"4":1,"5":1}`.
20. **Charts render.** `/agent/reports` shows two bar charts of non-zero height, fixed bar order (`OPEN, IN_PROGRESS, RESOLVED, CLOSED` and `LOW, MEDIUM, HIGH`), integer Y-axis ticks, and bars that change colour with the OS dark-mode setting (the `var(--chart-1)` binding).
21. **Nav.** "Reports" appears in the agent sidebar for both AGENT and ADMIN, between "Tickets" and "Customers", and highlights when active.
22. **Error state.** Stop the dev server with `/agent/reports` open and force a refetch: the `role="alert"` paragraph renders and the page does not blank.
23. **One terminal-status list.** `grep -rn '"RESOLVED"' lib/ app/ components/` — hits only at `lib/sla.ts:4` and `lib/validation/ticket.ts:9`. A third is the duplicated-rule bug this story must not introduce, and `portal-ticket-detail.tsx` is the file most likely to introduce it.
24. **No Prisma in the client bundle.** `grep -rn "@/lib/prisma" lib/report-metrics.ts lib/reports.ts lib/feedback.ts` returns nothing.
25. **Regression, Stories 01–07.** `/agent` (dashboard counts), `/agent/tickets` (filters, claim, sweep), a ticket detail page (comments still poll), the notification bell, `/agent/admin/audit`, `/agent/customers`, `/portal/tickets`, `/portal/faq` and `/register` all behave exactly as before. The only endpoints whose bodies changed are `GET`/`PATCH /api/tickets/[id]` and `POST /api/tickets/[id]/reopen`, each **gaining** `feedback` and losing nothing.

---

## Migration / Rollback

- **Forward:** back up first — `cp prisma/dev.db prisma/dev.db.story07.bak`, matching the existing `dev.db.story04.bak` / `dev.db.story06.bak` convention in `prisma/`. Then `npx prisma migrate dev --create-only --name add_feedback_and_ticket_resolved_at`, hand-append the backfill `UPDATE` (task 2), then `npx prisma migrate dev`.
- **Half-applied state.** SQLite runs each migration in a transaction, so the `CREATE TABLE` + `ALTER TABLE` + `UPDATE` either all land or none do. The realistic failure is the migration applying while the **application code** is not deployed: `resolvedAt` then stays `null` for newly resolved tickets and the reports under-count. Harmless and self-correcting once the code lands — but the tickets resolved during that window are permanently unmeasured, so deploy schema and code together.
- **Rollback:** restore the `.bak` file and `git revert` the commit. Do **not** hand-drop the `Feedback` table while leaving the row in `_prisma_migrations`; Prisma will report drift and the next `migrate dev` will offer a reset. If the migration is already applied and must be undone in place, delete both the migration directory and its `_prisma_migrations` row, then restore the backup.
- **`npm install recharts@^3.10.1`** adds `recharts` and its `react-is` peer to `package-lock.json`. Rolling back means reverting both `package.json` and `package-lock.json` and re-running `npm install` — a stale lock file with no `recharts` entry breaks the build, not just the charts.

---

## Verification Steps

1. **Schema and client regenerate:** `npx prisma migrate dev` then `npx prisma generate` in the repo root. `npx prisma migrate status` reports no pending migration.
2. **Dependency installed:** `npm install recharts@^3.10.1` in the repo root. `npm ls recharts` resolves to a `3.x` version with no unmet peer warnings against `react@19.2.8`.
3. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors. Run `npm run dev` once first so Next generates its route types — `RouteContext<"/api/tickets/[id]/feedback">` does not exist until the route file has been seen.
4. **Lint passes:** `npm run lint` in the repo root. Zero errors.
5. **Frontend runs:** `npm run dev`, then walk Test Plan items 3, 7, 12, 15, 20, 21, 22 at `http://localhost:3000`.
6. **Production build:** `npm run build` in the repo root. This is the step that catches a chart component missing `"use client"` and a Prisma import leaking into `lib/report-metrics.ts`; `dev` will not.
7. **Authorization:** Test Plan items 4 and 14 in full. **The AGENT → `403` on `/api/reports/agents` must not be skipped** — it is the acceptance criterion's explicit requirement.
8. **`resolvedAt` semantics:** Test Plan items 8, 9, 10, 11. Item 9 (`RESOLVED → CLOSED` does not rewrite) is the subtle one.
9. **Arithmetic:** Test Plan items 17, 18, 19. Check the rendered tiles against the raw `curl` payload, not against each other.
10. **One breach rule:** `grep -rn "RESOLVED" lib/ app/ components/`. Two hits only — `lib/sla.ts:4` and `lib/validation/ticket.ts:9`.
11. **Regression:** Test Plan item 25. No Story 01–07 redirect, status code, or authorisation may change, and no response body may **lose** a field.

---

## Done Criteria

- [ ] `prisma/schema.prisma` has a `Feedback` model with `id`, **`ticketId` (FK to `Ticket`, `@unique`, `onDelete: Cascade`)**, `rating Int`, `comment String?`, `createdAt`, and a `feedback Feedback?` back-relation on `Ticket`.
- [ ] `Ticket.resolvedAt DateTime?` exists with an `@@index([resolvedAt])`, and the migration **backfills it from `updatedAt` for already-terminal tickets**.
- [ ] `resolvedAt` is written **only** on a transition into `TERMINAL_STATUSES` and cleared on reopen; `RESOLVED → CLOSED` does **not** rewrite it, and a PATCH that does not touch `status` does not touch it.
- [ ] `POST /api/tickets/[id]/feedback` exists and returns: `401` unauthenticated, `403` for staff and for an orphan customer, `404` for a ticket the caller does not own, `409` for a non-terminal ticket, `409` for an already-rated ticket (**including the concurrent `P2002` case**), `400` for a rating outside 1–5 or a non-integer, and `201` otherwise.
- [ ] Ownership is checked through **`Customer.userId` via `resolveViewer()`**, with **no email-matching fallback** anywhere in the path.
- [ ] An empty or whitespace-only comment is stored as **`null`**, never `""`.
- [ ] `TICKET_DETAIL_SELECT` lives **once**, in `lib/ticket-select.ts`, is imported by both `app/api/tickets/[id]/route.ts` and `app/api/tickets/[id]/reopen/route.ts`, and now selects `feedback`. No route file declares it.
- [ ] `app/portal/tickets/[id]` shows the feedback prompt **only** when the ticket is terminal and unrated, shows the submitted rating once given, and offers **no edit control**. The status test reads `TERMINAL_STATUSES`, not a literal array.
- [ ] `GET /api/reports` is read-only, returns `401` unauthenticated, `403` for a CUSTOMER, `200` for AGENT and ADMIN, and carries ticket counts **zero-filled across all four `TICKET_STATUSES` and all three `TICKET_PRIORITIES`**, an SLA summary, and a CSAT summary.
- [ ] `GET /api/reports/agents` is guarded by **`requireAdmin()`** and returns **`403` to a plain AGENT** — the section is not merely hidden in the UI.
- [ ] `sla.onTimeRate` and `sla.averageResolutionMs` are **`null`, not `0`**, when there is nothing to measure, and the UI renders `—`. `csat.average` is `null`, not `0`, on an empty `Feedback` table.
- [ ] Tickets resolved with `dueAt: null` count toward `resolved` but not toward `measured`; tickets resolved while unassigned appear under **"Unassigned"** and are not dropped.
- [ ] `lib/report-metrics.ts` is pure — no `@/lib/prisma`, no `Request` — and is safely importable from client components.
- [ ] `app/agent/reports/page.tsx` is a server component; every `recharts` component file starts with `"use client"`; chart colours come from `var(--chart-N)`; every `ResponsiveContainer` has an explicit `height`.
- [ ] `components/agent/sidebar-nav.tsx` links `/agent/reports` from `BASE_LINKS` (**not** `ADMIN_LINKS`).
- [ ] Both report queries set **`staleTime: 0`** and **no `refetchInterval`**.
- [ ] The reports page has loading, error (`role="alert"`) and empty states, matching the `components/agent/dashboard/dashboard-overview.tsx` ladder.
- [ ] `recharts@^3.10.1` is the **only** new dependency; no pinned version in `package.json` moved.
- [ ] No feedback event writes an `AuditLog` row or a `Notification`.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 09.**
