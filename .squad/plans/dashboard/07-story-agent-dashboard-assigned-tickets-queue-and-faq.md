# Story 07 — Agent dashboard: assigned tickets, queue, and FAQ

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). Consumed, not re-implemented: `lib/prisma.ts`, `auth.ts`, `app/providers.tsx` (the single `SessionProvider` + `QueryClientProvider`, mounted at `app/layout.tsx:28` — **do not add a second provider**), `lib/roles.ts`, `app/agent/layout.tsx`, `app/portal/layout.tsx`, `components/agent/sidebar-nav.tsx`, `components/portal/top-nav.tsx`.
- **Story 02 completed and committed** ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md)). Owns the `Customer` model, `requireAgent()`, and the `lib/customers.ts` client-module idiom this story copies for `lib/dashboard.ts`.
- **Story 03 completed and committed** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`). Owns `lib/api/http.ts` and `lib/api/client.ts` (`ApiError`, `request<T>()`).
- **Story 05 completed and committed** ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), commit `ee1482f`). This story is a **read-only composition on top of it**. It consumes the `Ticket` model (`prisma/schema.prisma:59–94`), `lib/sla.ts`, `lib/tickets.ts`'s `TicketListItem` and `ticketKeys`, and `components/agent/tickets/ticket-table.tsx`'s SLA-badge markup. **No new core data model. No migration.**
- **Story 06 is implemented but NOT yet committed** ([`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md)). `git status` shows `lib/activity.ts`, `lib/audit.ts`, `lib/notifications.ts`, `lib/validation/notification.ts`, `app/api/notifications/`, `app/api/admin/audit/`, `app/agent/admin/audit/`, `components/agent/notification-bell.tsx`, `components/ui/popover.tsx`, and `prisma/migrations/20260829180255_add_audit_log_and_notification/` as untracked, with `prisma/schema.prisma`, `lib/api/http.ts`, `lib/ticket-access.ts`, `components/agent/sidebar-nav.tsx` and four ticket routes modified. **Commit Story 06 before starting this one.** This story reads `requireUser()` (`lib/api/http.ts:32–40`), which Story 06 introduced; if that export is missing, Story 06 is not in the tree and you must stop rather than re-declare it.
- **Versions are pinned and must not move.** Verified in `package.json`: `next@16.3.3`, `react@19.2.8`, `prisma@6.19.3`, `@prisma/client@6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`, `radix-ui@^1.6.7`, `lucide-react@^1.34.0`. **Do not run `npm install <pkg>@latest`.**
- **No new shadcn/ui component is required.** `components/ui/` already holds `badge`, `button`, `card`, `input`, `label`, `popover`, `select`, `table`, `textarea` — everything this story renders.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — no `test`. `## Test Plan` below is manual + `curl`, matching Stories 01–06.

---

## Story Goal

Turn the placeholder agent landing page into the operational dashboard, and give the portal a static FAQ:

1. **`GET /api/dashboard`** — one staff-only endpoint returning, for the calling agent: their assigned-ticket counts broken down by status, their breached count, the **unassigned queue** count, the queue's breached count, and the (capped) list of their live assigned tickets.
2. **The agent dashboard renders at `app/agent/page.tsx`**, the route `components/agent/sidebar-nav.tsx:11` already labels **"Dashboard"**. **Do not create `app/agent/dashboard/`.** The intake names that path, but `/agent` is already the dashboard route and already the nav's active target; a second route would be an unlinked duplicate that the sidebar's `pathname === "/agent"` check at `components/agent/sidebar-nav.tsx:31` never highlights. This is a deliberate deviation from the intake's literal wording, recorded here so it is not "fixed" later.
3. **The SLA-breach badge is reused, never recomputed.** `slaBreached` arrives on every row from the server exactly as it does for `GET /api/tickets` (`app/api/tickets/route.ts:54`); the badge markup is the one already at `components/agent/tickets/ticket-table.tsx:199`.
4. **A static FAQ at `app/portal/faq`** — 7 hardcoded Q&A entries in `lib/faq.ts`, rendered by a server component, linked from `components/portal/top-nav.tsx`. **No database table, no API route, no client component.**

**Not in scope** (from the intake): any chart or aggregate report, proactive SLA escalation or notification, a dynamic or searchable knowledge base, any AI-generated FAQ content, per-agent leaderboards, and any change to Story 05's ticket write paths.

---

## Context — Read These Files First

1. `app/agent/page.tsx` — all 13 lines. The placeholder this story replaces. Keep the `auth()` greeting; the counts and the list go **below** it.
2. `app/agent/layout.tsx` — lines 10–13. `session?.user` then `isStaff(session.user.role)`, **redirect not 403**. The dashboard page inherits this and therefore needs **no guard of its own**. The API route still guards itself — see item 5.
3. `components/agent/sidebar-nav.tsx` — all 51 lines. `BASE_LINKS` (10–14) already contains `{ href: "/agent", label: "Dashboard" }`; the active check at **line 31** special-cases `/agent` with `===` rather than `startsWith`. **This file needs no edit in this story.**
4. `app/api/tickets/route.ts` — all 131 lines. **Lines 15–25** are `TICKET_SELECT`, the exact list-row shape; task 2 moves it to `lib/ticket-select.ts`. **Lines 47–55** are the list query: `orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]` and the `isSlaBreached` map at line 54. Task 3's queries copy both.
5. `lib/api/http.ts` — all 61 lines. `requireAgent()` (11–16) returns `Response | null` and gives you **no identity**; `requireUser()` (32–40) returns `{ ok: true; user: { id, role } }`. The dashboard needs the caller's **id**, so it uses `requireUser()` plus an `isStaff` check — not `requireAgent()`. The comment at lines 6–9 is the rule: **`middleware.ts` excludes `/api/**` from its matcher (`middleware.ts:37`), so every route handler guards itself.**
6. `lib/sla.ts` — all 55 lines. **Line 4** is `TERMINAL_STATUSES` — currently **module-private**; task 1 exports it. **Lines 32–39** are `isSlaBreached`, the read-time computation with **no stored column**. Task 1 adds a Prisma `where` projection of the same rule beside it. Read the doc comment at 26–31 before touching anything here.
7. `lib/validation/ticket.ts` — lines 8–12. `TICKET_STATUSES` and the `TicketStatus` type. The dashboard's `byStatus` record is keyed by these and **zero-filled** from this array; a status with no tickets must render `0`, not vanish.
8. `lib/tickets.ts` — lines 15–31 and 59–64. `TicketListItem` (note the comment at 15–19: **`dueAt` and `createdAt` are ISO strings, not `Date`s**) and the `ticketKeys` factory. Task 4's `lib/dashboard.ts` re-exports the row type rather than declaring a second one.
9. `lib/notifications.ts` — all 36 lines. The closest precedent for task 4: a client module whose endpoint returns a **composite object** (`NotificationFeed`, lines 17–20) rather than a bare array, so `request<T>()` is called on the whole payload (line 28) with no destructuring.
10. `app/api/notifications/route.ts` — all 30 lines. The `Promise.all` of a `findMany` plus a `count` (12–27) that task 3 widens to five queries, and the `NOTIFICATION_PAGE_SIZE` cap idiom (line 5).
11. `components/agent/tickets/ticket-table.tsx` — all 217 lines. **Lines 30–33** the `useQuery`; **136–146** the `isPending` / `isError` / empty-state ladder that every list in this repo repeats; **161–202** the row markup; **196–201** the due-date cell with the `<Badge variant="destructive">SLA breached</Badge>` at **line 199** — copy that badge verbatim. **Lines 178–194** are the inline Claim button; the dashboard does **not** get one (see Edge Cases).
12. `components/agent/notification-bell.tsx` — lines 17–29. The polling `useQuery` with its own `staleTime: 0` and the comment explaining why a provider-wide `staleTime` does not stop an interval refetch. Task 8 uses the same `staleTime: 0` but **no `refetchInterval`**.
13. `app/providers.tsx` — lines 10–15. `defaultOptions.queries` is `{ staleTime: 30_000, refetchOnWindowFocus: false }`. A dashboard that is 30 s stale after a claim on another page is the failure this forces you to handle explicitly.
14. `components/ui/card.tsx` — all 103 lines. `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and the `size="sm"` prop at line 9. Task 6's count tiles use `size="sm"`.
15. `app/portal/layout.tsx` — all 19 lines. `CUSTOMER`-only (**line 11**), `TopNav`, and the `max-w-4xl` main. The FAQ page inherits all of it.
16. `components/portal/top-nav.tsx` — all 20 lines. One `Link` added beside "My tickets" (line 12) in task 11.
17. `middleware.ts` — lines 30–31 and the matcher at line 37. **Line 31 redirects any non-CUSTOMER away from `/portal/**`.** This is why an agent cannot open `/portal/faq`; see Edge Cases.
18. `app/layout.tsx` — lines 1 and 16–19. The `import type { Metadata } from "next"` + `export const metadata` idiom task 10 copies. This is the repo's **only** metadata export today.
19. `app/agent/tickets/page.tsx` — all 18 lines. The house split: a **server** page that renders a heading and delegates data to a **client** component. Task 9's page follows it exactly.
20. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — read the handler-signature section before writing `app/api/dashboard/route.ts`. It takes **no** dynamic segment, so there is no `RouteContext<…>` and no `await ctx.params` here, unlike `app/api/tickets/[id]/route.ts:33`.
21. `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` — the static `export const metadata` form (around line 23). The FAQ page uses the static object, **not** `generateMetadata()`.
22. Grep for `groupBy` in `node_modules/.prisma/client/index.d.ts`: present, and `TicketGroupByArgs` is generated. Prisma `groupBy` on SQLite is available; task 3 uses it.
23. Grep for `QueryMode` in `node_modules/.prisma/client/index.d.ts`: **zero hits.** SQLite has no case-insensitive Prisma filter. Nothing in this story does text comparison, and nothing in it should start.
24. Grep for `TERMINAL_STATUSES` across `app/`, `lib/`, `components/`: **one hit**, `lib/sla.ts:4`. After task 1 there are exactly two files importing it. If a third copy of `["RESOLVED", "CLOSED"]` appears anywhere in the diff, that is the bug this story is written to prevent.

---

## Product rules (from story)

| Concern | Before (Story 06) | After (Story 07) |
|---|---|---|
| `/agent` | Placeholder: name + role only | Assigned counts, queue count, and the agent's live assigned tickets |
| "Assigned to me" | Reachable only via the `/agent/tickets` filter dropdown | The dashboard's default and primary view |
| Unassigned queue visibility | A dropdown option an agent must go looking for | A **standing count** on the landing page |
| SLA breach on the dashboard | — | The **same server-computed `slaBreached`** flag and the **same badge** as `/agent/tickets` |
| Terminal-status tickets | Included in every list | **Excluded** from the dashboard's ticket list and from the queue count |
| Portal FAQ | No such page | `/portal/faq`, 7 static entries, linked from the portal nav |
| A staff member opening `/portal/faq` | — | Redirected to `/agent` by `middleware.ts:31`. **Known and accepted** — see Edge Cases |

**Additive and read-only.** No Story 01–06 endpoint changes its response body, its authorisation, or its status codes. The only edits to existing files are: `lib/sla.ts` (export an existing const, add two functions), `app/api/tickets/route.ts` (replace a local const with an import — **zero behaviour change**), `app/agent/page.tsx` (rewrite the body), `components/portal/top-nav.tsx` (one link). **No schema edit. No migration. No seed change.**

---

## Backend Tasks

### 1 — `lib/sla.ts`: one breach rule, two projections

**File: `lib/sla.ts`**

The dashboard counts breaches **in SQL**, because counting them in TypeScript means loading every ticket. That must not become a second, drifting copy of the breach rule. Export the existing status list and add the `where` projections beside `isSlaBreached`.

Change **line 4** from `const` to an exported const, keeping the comment above it:

```ts
/** Statuses that stop the SLA clock. A resolved ticket can never breach. */
export const TERMINAL_STATUSES: readonly TicketStatus[] = ["RESOLVED", "CLOSED"]
```

Append to the end of the file:

```ts
/**
 * The **same** rule as `isSlaBreached`, projected into a Prisma `where`
 * fragment so a count can run in SQL instead of loading every row.
 *
 * `isSlaBreached` stays the only thing a read path calls on a row it already
 * has; this is only for aggregates. Both read `TERMINAL_STATUSES`, so there is
 * still exactly one list of statuses that stop the clock. A third spelling of
 * `["RESOLVED", "CLOSED"]` anywhere in the codebase is a bug.
 *
 * The spread is required, not stylistic: `TERMINAL_STATUSES` is `readonly` and
 * Prisma's `notIn` takes a mutable `string[]`.
 */
export function slaBreachedWhere(now: Date = new Date()) {
  return { dueAt: { lt: now }, status: { notIn: [...TERMINAL_STATUSES] } }
}

/** Tickets still on the clock — the complement of `TERMINAL_STATUSES`. */
export function liveStatusWhere() {
  return { status: { notIn: [...TERMINAL_STATUSES] } }
}
```

**Do not** change `isSlaBreached` (32–39), `isSlaHalfElapsed` (46–55), `SLA_HOURS` (16–20), or `defaultDueAt` (22–24). Story 05's sweep and every existing read path depend on them unchanged.

### 2 — `lib/ticket-select.ts`: the shared list select

**Create file: `lib/ticket-select.ts`**

`TICKET_SELECT` is currently module-private at `app/api/tickets/route.ts:15–25`. A route file cannot export it — Next validates the exports of a `route.ts`, and a non-handler export is an error there, not a warning. So it moves to `lib/`.

```ts
/**
 * The list-row projection shared by `GET /api/tickets` and `GET /api/dashboard`.
 * It is the server-side counterpart of `TicketListItem` in `lib/tickets.ts:20–31`
 * — every field here appears there, and `slaBreached` is added by the caller
 * via `isSlaBreached`, never selected (there is no column).
 *
 * `as const` is load-bearing: without it Prisma widens the literal `true`s and
 * loses the narrowed result type.
 */
export const TICKET_LIST_SELECT = {
  id: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  dueAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  assignedAgent: { select: { id: true, name: true } },
} as const
```

**File: `app/api/tickets/route.ts`**

Delete **lines 15–25** and add the import beside the existing `@/lib/sla` import (line 4):

```ts
import { TICKET_LIST_SELECT } from "@/lib/ticket-select"
```

Then replace both `select: TICKET_SELECT` occurrences (**line 50** in `GET`, **line 114** in `POST`) with `select: TICKET_LIST_SELECT`.

**This is a pure rename.** The two response bodies, both status codes, the `logActivity` call at 117–125, and the `$transaction` at 111–128 are unchanged. If the diff for this file shows anything but the deleted const, the added import, and two renamed identifiers, revert and redo it.

**Do not** touch `TICKET_DETAIL_SELECT` in `app/api/tickets/[id]/route.ts:12–31` or `app/api/tickets/[id]/reopen/route.ts:7–26`. Those two are duplicates of each other today; de-duplicating them is a separate change and is **out of scope for this story**.

### 3 — `app/api/dashboard/route.ts`: the summary endpoint

**Create file: `app/api/dashboard/route.ts`**

```ts
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api/http"
import { isStaff } from "@/lib/roles"
import { isSlaBreached, liveStatusWhere, slaBreachedWhere } from "@/lib/sla"
import { TICKET_LIST_SELECT } from "@/lib/ticket-select"
import { TICKET_STATUSES, type TicketStatus } from "@/lib/validation/ticket"

/**
 * How many of the agent's own tickets the dashboard lists. The counts above the
 * list are exact and unbounded; only the rendered rows are capped. Same idiom as
 * `NOTIFICATION_PAGE_SIZE` (`app/api/notifications/route.ts:5`).
 */
const DASHBOARD_TICKET_LIMIT = 10

export async function GET() {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response
  const { user } = resolved

  // `requireUser()` rather than `requireAgent()`: this endpoint needs the
  // caller's **id**, and `requireAgent()` returns only a Response-or-null. The
  // role check is therefore explicit. A CUSTOMER gets a `403` here — unlike
  // `/api/notifications`, which returns an empty `200`, because there is no
  // customer-shaped reading of "the unassigned agent queue".
  if (!isStaff(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })

  // One `now` for all five queries. Computing it per-query lets a slow request
  // count a ticket as breached in one number and not in the next.
  const now = new Date()
  const mine = { assignedAgentId: user.id }
  const queue = { assignedAgentId: null }

  const [byStatusRows, assignedBreached, queueUnassigned, queueBreached, tickets] =
    await Promise.all([
      prisma.ticket.groupBy({
        by: ["status"],
        where: mine,
        _count: { _all: true },
      }),
      prisma.ticket.count({ where: { ...mine, ...slaBreachedWhere(now) } }),
      prisma.ticket.count({ where: { ...queue, ...liveStatusWhere() } }),
      prisma.ticket.count({ where: { ...queue, ...slaBreachedWhere(now) } }),
      prisma.ticket.findMany({
        where: { ...mine, ...liveStatusWhere() },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: DASHBOARD_TICKET_LIMIT,
        select: TICKET_LIST_SELECT,
      }),
    ])

  // Zero-fill. `groupBy` returns a row only for statuses that actually occur;
  // the UI renders one tile per status and must show `0`, not a gap.
  const byStatus = Object.fromEntries(
    TICKET_STATUSES.map((status) => [status, 0]),
  ) as Record<TicketStatus, number>

  for (const row of byStatusRows) {
    if ((TICKET_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as TicketStatus] = row._count._all
    }
  }

  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

  return Response.json({
    assigned: { total, byStatus, breached: assignedBreached },
    queue: { unassigned: queueUnassigned, breached: queueBreached },
    tickets: tickets.map((ticket) => ({ ...ticket, slaBreached: isSlaBreached(ticket, now) })),
  })
}
```

Notes the executor must not "clean up":

- **`isSlaBreached(ticket, now)` is passed the same `now`** the counts used. `app/api/tickets/route.ts:54` calls it with the default argument because it has only one clock to keep; this handler has five.
- **`assigned.total` counts every status**, including `RESOLVED` and `CLOSED`, because it is derived from `byStatus`, which is itself unfiltered. `tickets` and `queue.unassigned` exclude terminal statuses. That asymmetry is intentional: the tiles answer "what is on my plate, in what state", the list answers "what do I work on next".
- **The `where` spreads never collide.** `slaBreachedWhere` contributes `dueAt` and `status`; `mine` / `queue` contribute `assignedAgentId`. Adding another status filter alongside `slaBreachedWhere` would silently overwrite its `notIn` — don't.
- **No `POST`, `PATCH`, or `DELETE`.** This route is read-only.

### 4 — `lib/dashboard.ts`: the client data module

**Create file: `lib/dashboard.ts`**

```ts
import { request } from "@/lib/api/client"
import type { TicketListItem } from "@/lib/tickets"
import type { TicketStatus } from "@/lib/validation/ticket"

/**
 * The whole `GET /api/dashboard` payload. Composite rather than a bare array,
 * like `NotificationFeed` (`lib/notifications.ts:17–20`), so the page needs one
 * request for the counts and the list.
 *
 * `tickets` reuses `TicketListItem` — **do not** declare a second row type.
 * Its `dueAt` / `createdAt` are ISO **strings**, not `Date`s.
 */
export type DashboardSummary = {
  assigned: {
    total: number
    byStatus: Record<TicketStatus, number>
    breached: number
  }
  queue: {
    unassigned: number
    breached: number
  }
  tickets: TicketListItem[]
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/dashboard")
}
```

### 5 — `lib/faq.ts`: the static FAQ content

**Create file: `lib/faq.ts`**

```ts
/**
 * The portal FAQ. **Hardcoded on purpose** — the story explicitly rules out a
 * database table and a searchable knowledge base. Editing this array and
 * redeploying is the whole publishing workflow.
 *
 * Answers must stay consistent with behaviour Stories 04–06 actually ship. The
 * SLA figures below come from `SLA_HOURS` in `lib/sla.ts:16–20`; if that table
 * changes, change these strings in the same commit.
 */
export type FaqEntry = { question: string; answer: string }

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "How do I raise a support ticket?",
    answer:
      "Open “My tickets” and choose “New ticket”. Give it a subject, a category, a priority and a description. It reaches our queue the moment you submit it.",
  },
  {
    question: "How quickly will someone respond?",
    answer:
      "Target response times are 4 hours for HIGH priority, 24 hours for MEDIUM and 72 hours for LOW, measured from when the ticket is created. Tickets past their target are flagged to our agents automatically.",
  },
  {
    question: "What do the ticket statuses mean?",
    answer:
      "OPEN means the ticket is waiting to be picked up. IN_PROGRESS means an agent is working on it. RESOLVED means we believe it is fixed. CLOSED means the ticket is finished and archived.",
  },
  {
    question: "Can I add more information after submitting?",
    answer:
      "Yes. Open the ticket and post a comment. Comments are visible to you and to the agent handling the ticket, and the thread updates while you have the page open.",
  },
  {
    question: "Why can I only see some tickets?",
    answer:
      "The portal shows tickets belonging to your own customer profile and nothing else. If a ticket you expected is missing, it was most likely raised under a different account — tell us in a new ticket and we will link it.",
  },
  {
    question: "Can I change a ticket's priority after submitting it?",
    answer:
      "Not from the portal. Add a comment explaining the urgency and the agent handling your ticket can adjust it.",
  },
  {
    question: "How do I update my contact details?",
    answer:
      "Raise a ticket in the “Account” category with the details you want changed. Customer profiles are maintained by our team, so we make the change and confirm it on the ticket.",
  },
]
```

Seven entries — inside the intake's 5–8 range with room to drop one. Keep every answer to two sentences or fewer.

---

## Frontend Tasks

### 6 — `components/agent/dashboard/summary-cards.tsx`

**Create file: `components/agent/dashboard/summary-cards.tsx`**

Presentational only. **No `useQuery`, no `"use client"`** — it takes props and renders. Kept separate from task 8's fetching component so the tile layout is readable on its own.

```tsx
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardSummary } from "@/lib/dashboard"
import { TICKET_STATUSES } from "@/lib/validation/ticket"

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  // ...
}
```

Render, in a `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`:

- One `<Card size="sm">` **per status in `TICKET_STATUSES`** — iterate the array, never a hand-written list of four. `CardDescription` is the status, `CardContent` the count in `text-2xl font-semibold`. A `0` renders as `0`.
- One card **"Assigned to me"** showing `summary.assigned.total`, with `<Badge variant="destructive">{summary.assigned.breached} breached</Badge>` in its `CardContent` **only when `summary.assigned.breached > 0`** — same conditional-badge discipline as the unread count at `components/agent/notification-bell.tsx:47–51`.
- One card **"Unassigned queue"** showing `summary.queue.unassigned`, its `CardDescription` reading `"Waiting to be claimed"`, the same conditional breached badge, and a `<Button asChild variant="outline" size="sm">` wrapping `<Link href="/agent/tickets">` labelled **"Open the queue"**. That link is how an agent claims work; the dashboard itself has **no** inline Claim button (see Edge Cases).

The `Button asChild` + `Link` pairing is the one at `app/agent/tickets/page.tsx:11–13`.

### 7 — `components/agent/dashboard/assigned-ticket-list.tsx`

**Create file: `components/agent/dashboard/assigned-ticket-list.tsx`**

Presentational, props-only, no data fetching.

```tsx
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TicketListItem } from "@/lib/tickets"

export function AssignedTicketList({ tickets }: { tickets: TicketListItem[] }) {
  // ...
}
```

- Empty state: `<p className="text-sm text-muted-foreground">Nothing is assigned to you right now.</p>` — the exact class pair used at `components/agent/tickets/ticket-table.tsx:145`.
- Columns: **Subject**, **Customer**, **Priority**, **Status**, **Due**. **No Assignee column** — every row is the caller's by construction.
- Subject cell: a `<Link>` to `/agent/tickets/<id>` with `className="font-medium hover:underline"` — `components/agent/tickets/ticket-table.tsx:164–169`.
- Priority `<Badge variant="outline">`, status `<Badge variant="secondary">` — lines 173 and 176.
- Due cell: copy **lines 196–201 verbatim**, including `{ticket.slaBreached ? <Badge variant="destructive">SLA breached</Badge> : null}` and the `"—"` fallback for a null `dueAt`. **Do not** call `isSlaBreached` in this component; the flag is already on the row.

### 8 — `components/agent/dashboard/dashboard-overview.tsx`

**Create file: `components/agent/dashboard/dashboard-overview.tsx`**

The one client component. Owns the query; renders the two above.

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"

import { AssignedTicketList } from "@/components/agent/dashboard/assigned-ticket-list"
import { SummaryCards } from "@/components/agent/dashboard/summary-cards"
import { dashboardKeys, fetchDashboardSummary } from "@/lib/dashboard"

export function DashboardOverview() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: fetchDashboardSummary,
    // The provider-wide `staleTime: 30_000` (`app/providers.tsx:12`) would serve
    // a cached summary for half a minute after the agent claims a ticket on
    // `/agent/tickets` and navigates back. Counts are the one thing on this page
    // that must not be stale on arrival. No `refetchInterval` — the dashboard is
    // not a live monitor, and the only 30 s poller in this app is the bell
    // (`components/agent/notification-bell.tsx:27`).
    staleTime: 0,
  })

  // ...
}
```

Render the same three-branch ladder as `components/agent/tickets/ticket-table.tsx:136–146`:

- `isPending` → `<p className="text-sm text-muted-foreground">Loading dashboard…</p>`
- `isError` → `<p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load the dashboard."}</p>`
- otherwise → `<SummaryCards summary={data} />`, then an `<h2 className="text-lg font-medium">Assigned to me</h2>`, then `<AssignedTicketList tickets={data.tickets} />`.

Wrap in `<div className="space-y-6">`.

### 9 — `app/agent/page.tsx`: the dashboard page

**File: `app/agent/page.tsx`** — replace the whole body. Stays a **server** component; the `auth()` call and the greeting survive.

```tsx
import { auth } from "@/auth"

import { DashboardOverview } from "@/components/agent/dashboard/dashboard-overview"

export default async function AgentDashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Agent dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as {session?.user.name} ({session?.user.role}).
        </p>
      </div>
      <DashboardOverview />
    </div>
  )
}
```

**No guard here.** `app/agent/layout.tsx:12–13` already redirects a signed-out visitor to `/login` and a CUSTOMER to `/portal`. Adding a second check duplicates the rule and gives it two places to drift.

### 10 — `app/portal/faq/page.tsx`: the static FAQ

**Create file: `app/portal/faq/page.tsx`**

Server component. **No `"use client"`, no `useQuery`, no `auth()`** — nothing on this page depends on who is reading it.

```tsx
import type { Metadata } from "next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FAQ_ENTRIES } from "@/lib/faq"

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about the support portal",
}

export default function PortalFaqPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Frequently asked questions</h1>
        <p className="text-muted-foreground">
          Still stuck? Raise a ticket and an agent will pick it up.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ_ENTRIES.map((entry) => (
          <Card key={entry.question}>
            <CardHeader>
              <CardTitle>{entry.question}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{entry.answer}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

`key={entry.question}` is safe because questions are unique; keep them unique when editing `lib/faq.ts`. The static `metadata` export follows `app/layout.tsx:16–19` — **do not** reach for `generateMetadata()`, there is nothing dynamic to compute.

### 11 — `components/portal/top-nav.tsx`: link the FAQ

**File: `components/portal/top-nav.tsx`**

Add one `Link` immediately after the "My tickets" link (**lines 12–14**), matching its classes exactly:

```tsx
        <Link href="/portal/faq" className="text-sm text-muted-foreground hover:text-foreground">
          FAQ
        </Link>
```

Nothing else in this file changes. **`components/agent/sidebar-nav.tsx` needs no edit** — `/agent` is already in `BASE_LINKS`.

---

## Edge Cases & Failure Modes

- **A status with no tickets.** `prisma.ticket.groupBy` returns no row for it. Zero-filled from `TICKET_STATUSES` in `app/api/dashboard/route.ts` (task 3) before the response is built, so the UI always renders four tiles. Verified by Test Plan item 4.
- **An unknown `status` string in the database.** `status` is a `String` column (`prisma/schema.prisma:69`) — SQLite enforces nothing. A row with a value outside `TICKET_STATUSES` is skipped by the `includes` guard in the zero-fill loop, so it lands in no tile and `assigned.total` under-counts it. Deliberate: silently inventing a tile for a corrupt value is worse. Such a row still appears in `tickets` (it is not terminal) and still counts toward `queue.unassigned`.
- **A ticket with `dueAt: null`.** Never breaches (`lib/sla.ts:36`), and `slaBreachedWhere` excludes it via `dueAt: { lt: now }`, which SQL evaluates as NULL-false. It sorts **first** under `orderBy: [{ dueAt: "asc" }]` on SQLite, which puts undated tickets above urgent ones in the dashboard list. Accepted — it matches `GET /api/tickets` (`app/api/tickets/route.ts:49`) exactly, and diverging here would make two lists of the same tickets disagree on order.
- **A `RESOLVED` ticket past its `dueAt`.** Not breached, in both projections: `isSlaBreached` returns `false` at `lib/sla.ts:37`, and `slaBreachedWhere` excludes it via `notIn`. This is the single case that proves the two projections agree — Test Plan item 6.
- **An agent with more than 10 live assigned tickets.** The list is capped at `DASHBOARD_TICKET_LIMIT`; the **counts are not**. So the "Assigned to me" tile can read `23` above a table of 10 rows. Intended, and why the tile is a count and not a row tally. Pagination is out of scope; `/agent/tickets` with the "Assigned to me" filter is the full list.
- **A CUSTOMER calling `GET /api/dashboard` directly.** `403`, not an empty `200`. Different from `GET /api/notifications` (`app/api/notifications/route.ts`), which returns an empty list, because `queue.unassigned` is staff-only information about internal workload and there is no customer-shaped version of it. `middleware.ts` does not cover `/api/**` (matcher, line 37), so this guard in the handler is the only thing enforcing it. Test Plan item 9.
- **An unauthenticated call to `GET /api/dashboard`.** `401` from `requireUser()` (`lib/api/http.ts:36–38`) before any query runs.
- **An agent claims a ticket on `/agent/tickets`, then returns to `/agent`.** The dashboard's `staleTime: 0` (task 8) forces a refetch on mount, so the queue count drops immediately. Without it the provider's `staleTime: 30_000` (`app/providers.tsx:12`) would serve stale counts for up to 30 s. `ticketKeys` and `dashboardKeys` are **separate cache trees** — `invalidateQueries({ queryKey: ticketKeys.all })` at `components/agent/tickets/ticket-table.tsx:39` does **not** touch the dashboard, and it should not be made to.
- **Two agents claiming the same queue ticket at once.** Unchanged from Story 05: the dashboard shows a count, offers no Claim button, and links to `/agent/tickets`, where `authorizeAssignmentChange` (`lib/ticket-access.ts:82–104`) refuses the second claimant. **Adding a Claim button to the dashboard is out of scope** — it would need the loser's error state, the mutation, and the cross-tree invalidation that this story deliberately does not build.
- **The five queries are not in a transaction.** They run concurrently in one `Promise.all`, so a ticket claimed mid-request can be counted in `queue.unassigned` and again in `assigned.byStatus`. A read-only dashboard does not justify holding SQLite's lock; the shared `now` removes the only inconsistency worth removing. Do not "fix" this with `$transaction`.
- **A staff member opening `/portal/faq`.** `middleware.ts:31` redirects them to `/agent`. The FAQ is customer-facing and lives under the customer-only area, per the intake's first-listed path. Making it public (moving it to `app/help` and widening the matcher at `middleware.ts:37`) is a **deliberate deferral**, not an oversight — record it, do not do it here.
- **A signed-out visitor opening `/portal/faq`.** `middleware.ts:18–23` redirects to `/login?callbackUrl=/portal/faq`, and they land on the FAQ after signing in. That flow works today with no extra code.
- **`TICKET_LIST_SELECT` and `TicketListItem` drifting apart.** They are hand-kept in sync across `lib/ticket-select.ts` and `lib/tickets.ts:20–31`. A field added to one and not the other is a missing column at runtime, not a type error — TypeScript cannot see across the JSON boundary. Test Plan item 3 is the regression that catches it.
- **`slaBreachedWhere` composed with another `status` filter.** Object spread means the later `status` key wins and the `notIn` disappears, turning a breach count into "everything past due, resolved or not". No current call site does this; if you add one, merge the filters explicitly.

---

## Test Plan

No test runner is installed (`package.json` has no `test` script), so these are manual and `curl`, matching Stories 01–06. Sign in with the seeded accounts from `prisma/seed.ts`.

1. **Unit-shaped, by inspection — `lib/sla.ts` agreement.** `slaBreachedWhere` and `isSlaBreached` must both read `TERMINAL_STATUSES`. Run `grep -rn '"RESOLVED"' lib/ app/ components/` — the only hits are `lib/sla.ts:4` and `lib/validation/ticket.ts:9`. Any third hit is the duplicated-rule bug.
2. **Rename regression — `app/api/tickets/route.ts`.** `git diff app/api/tickets/route.ts` shows exactly: the deleted `TICKET_SELECT` const, one added import, two renamed identifiers. `grep -n "TICKET_SELECT" app/api/tickets/route.ts` returns nothing.
3. **Response-shape regression.** `curl -s -b cookies.txt http://localhost:3000/api/tickets | head -c 400` before and after task 2. Identical field sets, `slaBreached` still present on every row.
4. **Zero-filled tiles.** As an agent with no `CLOSED` tickets, load `/agent`. Four status tiles render; `CLOSED` shows `0`. `curl -s -b cookies.txt http://localhost:3000/api/dashboard | jq .assigned.byStatus` has all four keys.
5. **Counts match the ticket list.** Note `assigned.byStatus.OPEN` on `/agent`, then open `/agent/tickets` and filter Status=OPEN + Assignment="Assigned to me". Same number.
6. **Terminal statuses do not breach.** Pick an assigned ticket and `PATCH` its `dueAt` into the past: `assigned.breached` increments and the row shows the **SLA breached** badge. Then `PATCH` its `status` to `RESOLVED`: `assigned.breached` decrements, the row leaves the dashboard list (`liveStatusWhere`), and its tile count moves from OPEN to RESOLVED.
7. **Queue count and its freshness.** Create an unassigned ticket via the portal. `queue.unassigned` increments on `/agent` after reload. Claim it from `/agent/tickets`, then return to `/agent` — the count drops **on arrival**, not 30 s later. This is the `staleTime: 0` test; it fails if task 8's option was dropped.
8. **Queue excludes closed.** Set an unassigned ticket to `CLOSED` as an admin. `queue.unassigned` decrements.
9. **Authorization matrix for `GET /api/dashboard`:** no cookie → `401`; CUSTOMER cookie → `403`; AGENT cookie → `200`; ADMIN cookie → `200` scoped to **that admin's own** `assignedAgentId`, not to every agent's tickets.
10. **The 10-row cap.** Assign 12 live tickets to one agent. Tile reads `12`, table shows `10`, ordered by `dueAt` ascending.
11. **Empty state.** An agent with zero assigned tickets sees "Nothing is assigned to you right now." and four `0` tiles — no crash, no `undefined`.
12. **Error state.** Stop the dev server with `/agent` open and trigger a refetch: the `role="alert"` paragraph renders and the page does not blank.
13. **FAQ renders.** As a customer, `/portal/faq` shows 7 cards, the "FAQ" link is in the top nav, and the browser tab reads **"FAQ"** (the `metadata` export).
14. **FAQ is staff-blocked.** As an agent, open `/portal/faq` → redirected to `/agent` by `middleware.ts:31`. Confirm it is the redirect, not a 403 page or a crash.
15. **FAQ signed-out flow.** Signed out, open `/portal/faq` → `/login?callbackUrl=/portal/faq`; sign in as a customer → land on the FAQ.
16. **Regression, Stories 01–06.** `/agent/tickets` (filters, claim, sweep), a ticket detail page (comments still poll at 8 s), the notification bell (unread badge, mark-read), `/agent/admin/audit`, and `/portal/tickets` all behave exactly as before. No response body from those endpoints changed.
17. **No schema drift.** `npx prisma migrate status` reports no pending migration and `git diff prisma/schema.prisma` is **empty**. This story adds no column and no table.

---

## Verification Steps

1. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors. Run `npm run dev` once first so Next generates its route types.
2. **Lint passes:** `npm run lint` in the repo root. Zero errors.
3. **Frontend runs:** `npm run dev`, then walk Test Plan items 4–15 at `http://localhost:3000`.
4. **Authorization:** Test Plan item 9's matrix. The CUSTOMER `403` is the one that must not be skipped — it is the only thing standing between a customer and internal queue depth.
5. **Regression:** Test Plan items 2, 3, 16 and 17. No Story 01–06 response body, redirect, or migration may change.
6. **One breach rule:** `grep -rn "RESOLVED" lib/ app/ components/`. Two hits only — `lib/sla.ts:4` and `lib/validation/ticket.ts:9`. A third means the SQL count and the row flag can disagree.
7. **No stray dashboard route:** `ls app/agent/` must **not** contain a `dashboard/` directory. The dashboard is `app/agent/page.tsx`.
8. **Production build:** `npm run build`. It must succeed — `lib/faq.ts` and `lib/dashboard.ts` are imported by server and client code respectively, so a stray `@/lib/prisma` import in either fails here rather than in `dev`.

---

## Done Criteria

- [ ] `GET /api/dashboard` exists, is **read-only** (no `POST`/`PATCH`/`DELETE`), returns `401` unauthenticated, `403` for a CUSTOMER, and `200` for AGENT and ADMIN scoped to the caller's own `assignedAgentId`.
- [ ] The response carries `assigned.total`, `assigned.byStatus` **zero-filled across all four `TICKET_STATUSES`**, `assigned.breached`, `queue.unassigned`, `queue.breached`, and `tickets` capped at 10 and ordered `dueAt` ascending.
- [ ] The **unassigned queue count excludes `RESOLVED` and `CLOSED`**, so it reads as "waiting to be claimed" and not "unassigned, ever".
- [ ] `TERMINAL_STATUSES` is exported from `lib/sla.ts` and is the **only** list of clock-stopping statuses; `slaBreachedWhere()` and `isSlaBreached()` both read it, and neither re-spells `["RESOLVED", "CLOSED"]`.
- [ ] `TICKET_LIST_SELECT` lives in `lib/ticket-select.ts` and is imported by both `app/api/tickets/route.ts` and `app/api/dashboard/route.ts`; the move changed **no** response body and **no** status code.
- [ ] The dashboard renders at **`app/agent/page.tsx`**; there is **no `app/agent/dashboard/` directory**, and `components/agent/sidebar-nav.tsx` is unchanged.
- [ ] The dashboard shows one count tile per status plus an "Assigned to me" tile and an "Unassigned queue" tile, the latter linking to `/agent/tickets`.
- [ ] The **SLA-breach badge is the server-computed `slaBreached` flag from Story 05**, rendered with the same `<Badge variant="destructive">SLA breached</Badge>` markup as `components/agent/tickets/ticket-table.tsx:199`. No client component calls `isSlaBreached`, and no ticket row recomputes breach state.
- [ ] The dashboard query sets **`staleTime: 0`**, so counts are fresh on every arrival at `/agent`, and sets **no `refetchInterval`**.
- [ ] The dashboard has loading, error (`role="alert"`), and empty states, matching the `components/agent/tickets/ticket-table.tsx:136–146` ladder.
- [ ] The dashboard adds **no Claim button** and performs **no mutation**.
- [ ] `app/portal/faq/page.tsx` is a **server component** rendering 7 hardcoded entries from `lib/faq.ts`, with a static `metadata` export and **no database table, API route, or client component**.
- [ ] `components/portal/top-nav.tsx` links the FAQ; the link's classes match the existing "My tickets" link.
- [ ] `prisma/schema.prisma` is **unchanged** and no migration was added.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.
