# Story 06 — Audit trail and in-app notifications for ticket events

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). This story consumes `lib/prisma.ts`, `auth.ts`, `app/providers.tsx` (the single `QueryClientProvider` + `SessionProvider`), and edits `components/agent/sidebar-nav.tsx` in place.
- **Story 03 completed and committed** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`). This story reuses `requireAdmin()` (`lib/api/http.ts:19–24`), the `app/agent/admin/layout.tsx` ADMIN gate, the `/api/admin/**` route convention, and the `lib/users.ts` client-module idiom.
- **Story 05 completed and committed** ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), commit `ee1482f`). Every hook point in this story is a handler that story wrote. Unlike Story 05's own prerequisite situation, **this dependency is already committed** — no uncommitted-work check is needed before starting.
- **Versions are pinned and must not move.** Verified in `package.json`: `next@16.3.3`, `react@19.2.8`, `prisma@^6.19.3`, `@prisma/client@^6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`, `radix-ui@^1.6.7`, `lucide-react@^1.34.0`. The intake pins Prisma at 6.19.3 — **do not run `npm install <pkg>@latest`**.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — no runner. `## Test Plan` below is manual + `curl`, matching Stories 01–05.
- **One new shadcn/ui component** (`popover`, task 13) and **no new npm dependency**. `radix-ui` and `lucide-react` are already dependencies.

---

## Story Goal

Add two event-logging subsystems that **extend** Story 05's mutation handlers without rewriting their logic:

1. **An admin-only audit trail.** Every status change, priority change, and assignment change on a ticket writes an `AuditLog` row **inside the same transaction as the mutation**, readable at `/agent/admin/audit` and filterable by ticket.
2. **A per-agent notification bell.** Being given a ticket, losing a ticket, and receiving a comment on a ticket you are assigned to each write a `Notification` row for the affected agent. The agent sidebar shows an unread count and a dropdown of recent notifications.

Both are built on the same shape: a pure planner function that decides *what happened*, and a writer helper that persists it on the mutation's transaction client.

**Not in scope** (intake, "Out of scope"): real-time push (WebSocket/SSE) — the bell **polls**; email/SMS delivery; notification preferences; audit export or retention policy; **customer-facing notifications** — the portal gets no bell and customers are never a `Notification.userId` recipient in this story.

**Do not rewrite Story 05's handlers.** Each hook is an added planner call plus a `$transaction` wrapper around the write that is already there. If a diff hunk changes an authorisation decision, a status guard, a `select`, or a response shape from Story 05, it is wrong.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — all 111 lines. `User` (lines 13–29) gains two back-relations; `Ticket` (lines 57–89) gains one. Read the doc comment at lines 10–12: **SQLite has no Prisma `enum`**, which is why `AuditLog.action` and `Notification.type` are `String`s constrained in application code, exactly like `Ticket.status`.
2. `prisma/migrations/20260829031344_add_ticket_and_comment/migration.sql` — all 40 lines. The exact SQL shape task 2's migration must resemble: plain `CreateTable`s plus `CreateIndex`es, **no `new_User` / `new_Ticket` table redefinition**. A redefinition in the generated SQL means the schema edit added or changed a column on an existing model.
3. `app/api/tickets/[id]/route.ts` — all 138 lines. The primary hook point. `PATCH` (lines 48–121): the `current` read at lines 69–72, the assignment gate at lines 75–89, the `CLOSED` guard at lines 91–100, the `data` assembly at lines 102–106, and the `prisma.ticket.update` at lines 109–113 that task 6 wraps in a transaction. `DELETE` (lines 123–138) is task 8. **`TICKET_DETAIL_SELECT` (lines 10–30) does not change.**
4. `app/api/tickets/route.ts` — lines 57–125. `POST` resolves `customerId` / `assignedAgentId` in two branches (lines 80–108) and creates at lines 110–122. Task 8 wraps only the `create`. Note line 91: `assignToMe` is the **only** way a create is pre-assigned.
5. `app/api/tickets/[id]/comments/route.ts` — all 58 lines. `loadScopedTicket` (lines 14–25) returns `{ ok, viewer }` and today selects only `{ id: true }` from the ticket — task 9 widens that `select`. `POST` creates the comment at lines 52–55.
6. `app/api/tickets/[id]/reopen/route.ts` — lines 29–53. Task 7 wraps the `update` at lines 47–51.
7. `app/api/tickets/assign-sweep/route.ts` — all 68 lines. Task 10 converts the **array-form** `$transaction` at lines 57–65 into the interactive form. The load-balancing loop at lines 40–54 and the `agents` query at lines 21–24 are **unchanged**.
8. `lib/ticket-access.ts` — all 98 lines. `Viewer` (lines 5–16) gains a `name` field in task 4; `resolveViewer` (lines 28–47) is where it is populated. `authorizeAssignmentChange` (lines 76–98) and its truth table are **read-only for this story** — the audit trail records decisions it makes, it does not change them.
9. `lib/api/http.ts` — all 45 lines. `requireAgent` (11–16), `requireAdmin` (19–24), `validationError` (26–29), `notFound` (31–33), `readJson` (36–45). Task 3 adds `requireUser()` next to them, in the same `{ ok } | { response }` shape `readJson` and `resolveViewer` already use. Note the doc comment at lines 6–9: **`middleware.ts` excludes `/api/**`**, so every new route guards itself.
10. `middleware.ts` — line 37, the matcher `"/((?!api|_next/static|_next/image|favicon.ico).*)"`. Confirms point 9. **`middleware.ts` needs no edit**: `/agent/admin/audit` sits under `/agent`, already staff-gated at line 30.
11. `app/agent/admin/layout.tsx` — all 14 lines. `session?.user.role !== "ADMIN"` → `redirect("/agent")`. This layout wraps **every** nested route, so `app/agent/admin/audit/page.tsx` inherits the ADMIN gate with no code of its own.
12. `app/api/admin/users/route.ts` — lines 8–18. The `requireAdmin()` → `findMany` → `Response.json({ users })` shape task 11's audit endpoint copies.
13. `components/agent/sidebar-nav.tsx` — all 44 lines. `BASE_LINKS` (9–13), `ADMIN_LINKS` (15), the `role === "ADMIN"` concat at line 19, and the active check at lines 24–25 (`/agent` exact, everything else `startsWith`). Task 15 adds one admin link and renders the bell above the `<nav>`.
14. `app/agent/layout.tsx` — lines 15–26. `<SidebarNav role={session.user.role} />` at line 19 sits inside the `<aside>`. **No edit needed** — the bell is added inside `SidebarNav`, per the acceptance criteria.
15. `components/agent/tickets/comment-thread.tsx` — lines 20–39. The polling idiom this story reuses: `refetchInterval` + `staleTime: 0` with the provider-wide 30 s `staleTime` (`app/providers.tsx:12`) deliberately overridden, and `refetchIntervalInBackground` **left at its default `false`**.
16. `components/agent/tickets/ticket-table.tsx` — lines 22, 57–110. The `const ALL = "__all__"` sentinel plus `Select` filter idiom that task 17's audit filter copies. A `SelectItem` with `value=""` is illegal in Radix — that is why the sentinel exists.
17. `components/agent/admin/user-table.tsx` — all 44 lines. The `useQuery` → `isPending` / `isError` / `Table` ladder task 17 mirrors.
18. `lib/users.ts` — all 33 lines. The client-module shape: an ISO-**string** `createdAt` type, a `*Keys` factory, and thin `request<T>` wrappers. Tasks 14 follows it exactly.
19. `lib/tickets.ts` — lines 59–64 (`ticketKeys`) and 75–80 (`fetchTickets`). Task 17 reuses `fetchTickets()` for the audit page's ticket filter.
20. `lib/validation/ticket.ts` — lines 8–12. The `as const` tuple + derived type idiom for a String-backed enum. Task 1 repeats it for audit actions and notification types.
21. `components.json` — `"style": "radix-nova"`, `"iconLibrary": "lucide"`. Task 13's `shadcn add` must match both.
22. `components/ui/badge.tsx` — lines 7–29. Available variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`.
23. `types/next-auth.d.ts` — lines 4–15. `Session["user"]` is `{ id: string; role: Role } & DefaultSession["user"]`, and `DefaultSession["user"]` types `name` as `string | null | undefined`. That nullability is why task 4 coalesces rather than asserts.
24. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — the **Route Context Helper** section. Confirm the Next 16 handler signature before writing task 12; `RouteContext<"/api/notifications/[id]">` is a **global** type with no import and `ctx.params` is a **Promise**.
25. Grep for `prisma.$transaction` before you start: **one** hit, `app/api/tickets/assign-sweep/route.ts:57`, in the array form. After this story there are six, five of them interactive.

---

## Product rules (from story)

| Concern | Story 05 (current) | Story 06 (new) |
|---|---|---|
| Ticket status / priority change | `prisma.ticket.update` | Same update, wrapped in a transaction that also writes an `AuditLog` row per changed field |
| Assignment change | `authorizeAssignmentChange` then update | Unchanged authorisation; adds an `AuditLog` row **and** a `Notification` for the agent gained and the agent lost |
| Comment posted | `prisma.comment.create` | Same create, plus a `Notification` for the ticket's assignee — **never** for the comment author |
| Who sees the trail | — | ADMIN only, at `/agent/admin/audit` |
| Who gets notifications | — | Staff recipients only. Customers get no bell and are never a recipient |
| Delivery | — | **Polling** — 30 s on the bell. No WebSocket, no SSE, no `setInterval` |
| Actor's own actions | — | **Never** produce a notification for the actor. They do produce audit rows |

**Additive only.** Every Story 05 request that succeeded before must return the same status and the same JSON body after. The only observable API change is that a failed audit or notification write now rolls the ticket mutation back — see `## Edge Cases & Failure Modes`.

---

## Backend Tasks

### 1 — `lib/validation/notification.ts`: the String-backed enums and the PATCH schema

**Create file: `lib/validation/notification.ts`.** Client-safe: `zod` only, **no `@prisma/client` and no `@/lib/prisma` import** — `components/agent/admin/audit-table.tsx` and the bell both import from here.

```ts
import { z } from "zod"

/**
 * `AuditLog.action` and `Notification.type` are Strings, not Prisma enums, for
 * the same reason `Ticket.status` is: SQLite has no `enum`
 * (`prisma/schema.prisma:10–12`). These tuples are the only place the allowed
 * values are listed.
 */
export const AUDIT_ACTIONS = [
  "TICKET_CREATED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "CLAIMED",
  "ASSIGNED",
  "RELEASED",
  "REASSIGNED",
  "REOPENED",
  "TICKET_DELETED",
] as const

export const NOTIFICATION_TYPES = [
  "TICKET_ASSIGNED",
  "TICKET_UNASSIGNED",
  "TICKET_COMMENTED",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/**
 * `read` is a boolean, not an implicit `true`, so the same endpoint can mark a
 * notification unread. `PATCH` with `{ "read": true }` twice is a no-op, not an
 * error.
 */
export const markNotificationSchema = z.object({ read: z.boolean() })

export type MarkNotificationInput = z.infer<typeof markNotificationSchema>
```

- **`CLAIMED` and `ASSIGNED` are distinct.** `null → self` is a claim; `null → someone else` is an admin assignment. The intake names `CLAIMED` and `REASSIGNED` as examples, not as the full list.
- Do **not** re-list these strings in the schema, in a route, or in a component.

---

### 2 — `prisma/schema.prisma`: `AuditLog` and `Notification`

**File: `prisma/schema.prisma`** — append both models, and add the back-relations to `User` and `Ticket`.

On `User` (after `comments Comment[]`, line 28):

```prisma
  auditLogs     AuditLog[]
  notifications Notification[]
```

On `Ticket` (after `comments Comment[]`, line 84):

```prisma
  notifications Notification[]
```

Then, at the end of the file:

```prisma
/// Append-only trail of ticket mutations. Written by `logActivity()` in
/// `lib/activity.ts`, always on the same transaction as the change it records.
model AuditLog {
  id         String   @id @default(cuid())
  /// Currently always "Ticket". A String, not an enum, so a later story can
  /// log Customer or User changes without a migration.
  entityType String
  /// **Deliberately not a foreign key.** `DELETE /api/tickets/[id]` exists
  /// (`app/api/tickets/[id]/route.ts:123`), and the record that a ticket was
  /// deleted is exactly the row an FK would cascade away. Read paths must
  /// therefore treat `entityId` as possibly dangling.
  entityId   String
  /// One of `AUDIT_ACTIONS` in `lib/validation/notification.ts`.
  action     String
  actorId    String
  /// `Restrict`, matching `Comment.author`: an account with history cannot be
  /// deleted out from under it.
  actor      User     @relation(fields: [actorId], references: [id], onDelete: Restrict)
  /// Human-readable, **immutable** summary written at the moment of the change.
  /// It embeds the actor's name on purpose — the trail says what was true then,
  /// not what a later rename made true.
  detail     String
  createdAt  DateTime @default(now())

  @@index([entityType, entityId, createdAt])
  @@index([createdAt])
}

/// One message for one staff recipient. Written by `notify()` in
/// `lib/activity.ts`. Agent-facing only in this story — a CUSTOMER is never a
/// recipient.
model Notification {
  id              String   @id @default(cuid())
  userId          String
  /// `Cascade`: notifications are per-recipient and worthless without them.
  /// Contrast `AuditLog.actor`, which is `Restrict` because it is history.
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// One of `NOTIFICATION_TYPES` in `lib/validation/notification.ts`.
  type            String
  message         String
  /// Nullable per the acceptance criteria. `Cascade`, matching `Comment.ticket`
  /// — a notification pointing at a deleted ticket is a dead link.
  relatedTicketId String?
  relatedTicket   Ticket?  @relation(fields: [relatedTicketId], references: [id], onDelete: Cascade)
  read            Boolean  @default(false)
  createdAt       DateTime @default(now())

  @@index([userId, read, createdAt])
}
```

- **No existing column changes.** `User`, `Ticket`, `Customer`, and `Comment` gain only relation fields, which are not columns.
- `@@index([userId, read, createdAt])` serves both the unread count and the recent-list query; a second index on `[userId, createdAt]` would be redundant, since SQLite uses the leading `userId` prefix.

Generate the migration:

```
npx prisma migrate dev --name add_audit_log_and_notification
```

Read the generated SQL before committing — expected: two `CreateTable`s and three `CreateIndex`es, nothing else (see Context item 2).

---

### 3 — `lib/api/http.ts`: add `requireUser()`

**File: `lib/api/http.ts`** — append after `requireAdmin` (line 24). **Do not touch `requireAgent` or `requireAdmin`.**

```ts
/**
 * Any authenticated caller, with the identity attached. Used by
 * `/api/notifications/**`, which is scoped by `userId` rather than by role: a
 * CUSTOMER hitting it gets an empty list, not a `403`. Same
 * `{ ok } | { response }` shape as `readJson` and `resolveViewer`.
 */
export async function requireUser(): Promise<
  { ok: true; user: { id: string; role: Role } } | { ok: false; response: Response }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { ok: true, user: { id: session.user.id, role: session.user.role } }
}
```

Add `type Role` to the existing `lib/roles` import at line 4: `import { isStaff, type Role } from "@/lib/roles"`.

---

### 4 — `lib/ticket-access.ts`: carry the actor's display name on `Viewer`

**File: `lib/ticket-access.ts`** — **additive only.** Every existing field, every existing call site, and both `ticketScopeWhere` and `authorizeAssignmentChange` are unchanged.

Add `name: string` to all three `Viewer` variants (lines 5–16), then populate it in `resolveViewer`:

```ts
  const { id, role } = session.user
  // `DefaultSession["user"]` types `name` as `string | null | undefined`
  // (`types/next-auth.d.ts:9`), even though the credentials provider always
  // returns one (`auth.ts:32`). Coalesce rather than assert — an audit `detail`
  // reading "undefined" is worse than one reading "Unknown user".
  const name = session.user.name ?? "Unknown user"

  if (isStaff(role)) return { ok: true, viewer: { kind: "staff", id, name, role } }
```

…and the same `name` on the `customer` and `orphan` returns at lines 44–46.

**Why here and not a second `prisma.user.findUnique` in each handler:** the name is already in the session `resolveViewer` reads. Adding a query per mutation to fetch a string we hold is the wrong trade.

---

### 5 — `lib/activity.ts`: the writers and the pure planners

**Create file: `lib/activity.ts`.** Server-side. Imports `Prisma` **type-only** and never imports `@/lib/prisma` — the transaction client is always passed in.

```ts
import type { Prisma } from "@prisma/client"

import type { AuditAction, NotificationType } from "@/lib/validation/notification"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

export type AuditEntry = {
  entityType: "Ticket"
  entityId: string
  action: AuditAction
  actorId: string
  detail: string
}

export type NotificationInput = {
  userId: string
  type: NotificationType
  message: string
  relatedTicketId: string | null
}

/**
 * Writes audit rows. `tx` is **required, not optional**: every caller runs
 * inside the same interactive transaction as the mutation it records, so a
 * rolled-back ticket update can never leave a row claiming it happened. A
 * fire-and-forget variant is the one thing this module must not grow.
 *
 * Sequential `create` rather than `createMany`: at most three rows per call,
 * and `createMany`'s `skipDuplicates` is unsupported on SQLite anyway.
 */
export async function logActivity(
  tx: Prisma.TransactionClient,
  entries: AuditEntry[],
): Promise<void> {
  for (const entry of entries) {
    await tx.auditLog.create({ data: entry })
  }
}

/**
 * Writes notification rows, **dropping every entry addressed to `actorId`**.
 * That single filter is what implements "notify the assignee, not the comment
 * author" and what stops an agent being told about their own claim. Callers
 * therefore never need to check "is this me?" themselves.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  actorId: string,
  inputs: NotificationInput[],
): Promise<void> {
  for (const input of inputs) {
    if (input.userId === actorId) continue
    await tx.notification.create({ data: input })
  }
}

type TicketBefore = {
  status: TicketStatus
  priority: TicketPriority
  assignedAgentId: string | null
}

type TicketPatch = {
  status?: TicketStatus
  priority?: TicketPriority
  assignedAgentId?: string | null
}

/**
 * **Pure.** No Prisma, no `Request`. Decides which audit entries a PATCH earns,
 * comparing against the values already stored — a PATCH that sets `status` to
 * the value it already has produces **no** row.
 *
 * `agentNames` carries display names the caller already loaded; ids are the
 * fallback so a missing name degrades to something traceable rather than to
 * "null".
 */
export function describeTicketChanges(
  before: TicketBefore,
  patch: TicketPatch,
  actor: { id: string; name: string },
  agentNames: { previous: string | null; next: string | null },
): { action: AuditAction; detail: string }[] {
  const changes: { action: AuditAction; detail: string }[] = []

  if (patch.status !== undefined && patch.status !== before.status) {
    changes.push({
      action: "STATUS_CHANGED",
      detail: `Status changed from ${before.status} to ${patch.status} by ${actor.name}.`,
    })
  }

  if (patch.priority !== undefined && patch.priority !== before.priority) {
    changes.push({
      action: "PRIORITY_CHANGED",
      detail: `Priority changed from ${before.priority} to ${patch.priority} by ${actor.name}.`,
    })
  }

  // `assignedAgentId: null` is a real value (a release), so the key's presence
  // is tested with `!== undefined`, never with truthiness — the same trap
  // `app/api/tickets/[id]/route.ts:75` avoids with `in`.
  if (patch.assignedAgentId !== undefined && patch.assignedAgentId !== before.assignedAgentId) {
    const next = patch.assignedAgentId
    const nextName = agentNames.next ?? next
    const previousName = agentNames.previous ?? before.assignedAgentId

    if (next === null) {
      changes.push({
        action: "RELEASED",
        detail: `Released to the queue from ${previousName} by ${actor.name}.`,
      })
    } else if (before.assignedAgentId === null) {
      changes.push(
        next === actor.id
          ? { action: "CLAIMED", detail: `Claimed by ${actor.name}.` }
          : { action: "ASSIGNED", detail: `Assigned to ${nextName} by ${actor.name}.` },
      )
    } else {
      changes.push({
        action: "REASSIGNED",
        detail: `Reassigned from ${previousName} to ${nextName} by ${actor.name}.`,
      })
    }
  }

  return changes
}

/**
 * **Pure.** The notification side of an assignment change: the agent who gained
 * the ticket and the agent who lost it. Self-addressed entries are left in —
 * `notify()` drops them, so this function stays independent of who acted.
 */
export function assignmentNotifications(
  ticket: { id: string; subject: string },
  before: string | null,
  next: string | null,
  actorName: string,
): NotificationInput[] {
  if (before === next) return []

  const inputs: NotificationInput[] = []

  if (next !== null) {
    inputs.push({
      userId: next,
      type: "TICKET_ASSIGNED",
      message: `${actorName} assigned "${ticket.subject}" to you.`,
      relatedTicketId: ticket.id,
    })
  }

  if (before !== null) {
    inputs.push({
      userId: before,
      type: "TICKET_UNASSIGNED",
      message: `${actorName} moved "${ticket.subject}" away from you.`,
      relatedTicketId: ticket.id,
    })
  }

  return inputs
}
```

`describeTicketChanges` and `assignmentNotifications` are pure for the same reason `authorizeAssignmentChange` and the `lib/sla.ts` helpers are: they become the first unit tests the day a runner lands.

---

### 6 — `app/api/tickets/[id]/route.ts` `PATCH`: audit + notify on the mutation transaction

**File: `app/api/tickets/[id]/route.ts`** — the main hook. Four edits, all additive.

**(a)** Widen the `current` read at lines 69–72 so the planners have names to work with:

```ts
  const current = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      assignedAgentId: true,
      assignedAgent: { select: { name: true } },
    },
  })
```

**(b)** In the assignment block at lines 75–89, keep the gate and the `isStaff` validation **exactly as they are** and capture the target's name from the lookup that already runs:

```ts
  let nextAgentName: string | null = null

  if ("assignedAgentId" in parsed.data) {
    const next = parsed.data.assignedAgentId ?? null
    const decision = authorizeAssignmentChange(current.assignedAgentId, next, viewer)
    if (!decision.allowed) return Response.json({ error: decision.reason }, { status: 403 })

    if (next !== null) {
      const target = await prisma.user.findUnique({
        where: { id: next },
        select: { name: true, role: true },
      })
      if (!target || !isRole(target.role) || !isStaff(target.role)) {
        return Response.json(
          { error: "Validation failed", fieldErrors: { assignedAgentId: ["Choose a staff account."] } },
          { status: 400 },
        )
      }
      nextAgentName = target.name
    }
  }
```

Only the `select` and the `nextAgentName` capture change. **The `403` and the `400` branches are untouched.**

**(c)** After the `data` assembly at lines 102–106, plan the two event sets:

```ts
  const changes = describeTicketChanges(
    {
      status: current.status as TicketStatus,
      priority: current.priority as TicketPriority,
      assignedAgentId: current.assignedAgentId,
    },
    parsed.data,
    { id: viewer.id, name: viewer.name },
    { previous: current.assignedAgent?.name ?? null, next: nextAgentName },
  )

  const notifications =
    "assignedAgentId" in parsed.data
      ? assignmentNotifications(
          { id: current.id, subject: current.subject },
          current.assignedAgentId,
          parsed.data.assignedAgentId ?? null,
          viewer.name,
        )
      : []
```

The `as TicketStatus` / `as TicketPriority` casts are needed because Prisma types these columns as `string` — the constraint lives in `lib/validation/ticket.ts`, not in the database.

**(d)** Wrap the update at lines 108–120. The `try` / `P2025` handling stays exactly where it is, now around the transaction:

```ts
  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({ where: { id }, data, select: TICKET_DETAIL_SELECT })

      await logActivity(
        tx,
        changes.map((change) => ({
          entityType: "Ticket" as const,
          entityId: id,
          action: change.action,
          actorId: viewer.id,
          detail: change.detail,
        })),
      )
      await notify(tx, viewer.id, notifications)

      return updated
    })

    return Response.json({ ticket: { ...ticket, slaBreached: isSlaBreached(ticket) } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound("Ticket not found.")
    }
    throw error
  }
```

Add to the imports: `assignmentNotifications`, `describeTicketChanges`, `logActivity`, `notify` from `@/lib/activity`, and `type TicketPriority`, `type TicketStatus` from `@/lib/validation/ticket`.

---

### 7 — `app/api/tickets/[id]/reopen/route.ts`: audit `REOPENED`, notify the assignee

**File: `app/api/tickets/[id]/reopen/route.ts`** — widen the `current` read at line 40 and wrap the update at lines 47–51. The `409` guard and its ordering are unchanged.

```ts
  const current = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true, status: true, assignedAgentId: true },
  })
  if (!current) return notFound("Ticket not found.")

  if (current.status !== "CLOSED") {
    return Response.json({ error: "This ticket is not closed." }, { status: 409 })
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: { status: "OPEN" },
      select: TICKET_DETAIL_SELECT,
    })

    await logActivity(tx, [
      {
        entityType: "Ticket",
        entityId: id,
        action: "REOPENED",
        actorId: viewer.id,
        detail: `Reopened by ${viewer.name}.`,
      },
    ])

    await notify(
      tx,
      viewer.id,
      current.assignedAgentId === null
        ? []
        : [
            {
              userId: current.assignedAgentId,
              type: "TICKET_ASSIGNED",
              message: `${viewer.name} reopened "${current.subject}", still assigned to you.`,
              relatedTicketId: id,
            },
          ],
    )

    return updated
  })
```

---

### 8 — `app/api/tickets/route.ts` `POST` and `app/api/tickets/[id]/route.ts` `DELETE`: the ends of a ticket's life

**File: `app/api/tickets/route.ts`** — wrap the create at lines 110–122:

```ts
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: { subject, description, category, priority, status: "OPEN", customerId, assignedAgentId, dueAt },
      select: TICKET_SELECT,
    })

    await logActivity(tx, [
      {
        entityType: "Ticket",
        entityId: created.id,
        action: "TICKET_CREATED",
        actorId: viewer.id,
        detail: `Ticket created by ${viewer.name}${assignedAgentId === viewer.id ? " and claimed" : ""}.`,
      },
    ])

    return created
  })
```

**No `notify()` here.** The only way a create is pre-assigned is `assignToMe` (line 91), which is by definition the actor — `notify` would drop it anyway, so the call would be dead code. A customer-submitted ticket also lands here and correctly logs the customer as actor: `viewer.id` is a real `User.id` in both branches, which is what `AuditLog.actor`'s `Restrict` relation requires.

**File: `app/api/tickets/[id]/route.ts`** — `DELETE` (lines 123–138). Read the subject first, then delete and log in one transaction:

```ts
  const existing = await prisma.ticket.findUnique({ where: { id }, select: { subject: true } })
  if (!existing) return notFound("Ticket not found.")

  const session = await auth()
  const actorId = session!.user.id
  const actorName = session!.user.name ?? "Unknown user"

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ticket.delete({ where: { id } })
      await logActivity(tx, [
        {
          entityType: "Ticket",
          entityId: id,
          action: "TICKET_DELETED",
          actorId,
          detail: `Ticket "${existing.subject}" deleted by ${actorName}.`,
        },
      ])
    })
    return Response.json({ ok: true })
  } catch (error) {
    // unchanged P2025 branch
  }
```

`DELETE` is guarded by `requireAdmin()` (line 124), which returns no identity — hence the `auth()` call (add `import { auth } from "@/auth"`) and the `!` assertions, which are safe **only** because `requireAdmin()` has already returned `null`. This is the row that proves `AuditLog.entityId` must not be a foreign key: the ticket it names no longer exists.

---

### 9 — `app/api/tickets/[id]/comments/route.ts` `POST`: notify the assignee

**File: `app/api/tickets/[id]/comments/route.ts`** — widen `loadScopedTicket`'s `select` (lines 18–22) so `POST` can see who to notify, and return the ticket:

```ts
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketScopeWhere(resolved.viewer) },
    select: { id: true, subject: true, assignedAgentId: true },
  })
  if (!ticket) return { ok: false as const, response: notFound("Ticket not found.") }

  return { ok: true as const, viewer: resolved.viewer, ticket }
```

`GET` (lines 27–39) ignores the extra fields and is otherwise unchanged. Then in `POST`, replace the bare create at lines 52–55:

```ts
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { ticketId: id, authorId: scoped.viewer.id, body: parsed.data.body },
      select: COMMENT_SELECT,
    })

    await notify(
      tx,
      scoped.viewer.id,
      scoped.ticket.assignedAgentId === null
        ? []
        : [
            {
              userId: scoped.ticket.assignedAgentId,
              type: "TICKET_COMMENTED",
              message: `${scoped.viewer.name} commented on "${scoped.ticket.subject}".`,
              relatedTicketId: id,
            },
          ],
    )

    return created
  })
```

- **No audit row for comments.** The acceptance criteria scope `logActivity()` to status, priority, and assignment. A comment is already visible in the thread it belongs to.
- **The assignee is the only recipient**, and `notify`'s self-filter means an assignee commenting on their own ticket notifies nobody. An unassigned ticket notifies nobody.
- This is the path a **customer** takes, so `scoped.viewer.name` must be populated for the `customer` variant too — that is why task 4 puts `name` on all three `Viewer` variants, not just `staff`.

---

### 10 — `app/api/tickets/assign-sweep/route.ts`: audit and notify every swept assignment

**File: `app/api/tickets/assign-sweep/route.ts`** — the eligibility filter (lines 13–20), the agent query (21–24), and the load-balancing loop (35–54) are **completely unchanged**. Only the write at lines 56–65 changes, from the array form to the interactive form.

The sweep is `requireAdmin()`-guarded with no identity, like `DELETE`, so read the actor and the ticket subjects first:

```ts
  const session = await auth()
  const actorId = session!.user.id
  const actorName = session!.user.name ?? "Unknown user"

  const subjects = new Map(
    (
      await prisma.ticket.findMany({
        where: { id: { in: assignments.map((assignment) => assignment.ticketId) } },
        select: { id: true, subject: true },
      })
    ).map((ticket) => [ticket.id, ticket.subject]),
  )

  if (assignments.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.ticket.update({
          where: { id: assignment.ticketId },
          data: { assignedAgentId: assignment.agentId },
        })

        const subject = subjects.get(assignment.ticketId) ?? assignment.ticketId

        await logActivity(tx, [
          {
            entityType: "Ticket",
            entityId: assignment.ticketId,
            action: "ASSIGNED",
            actorId,
            detail: `Assigned to ${assignment.agentName} by the assignment sweep, run by ${actorName}.`,
          },
        ])

        await notify(tx, actorId, [
          {
            userId: assignment.agentId,
            type: "TICKET_ASSIGNED",
            message: `The assignment sweep gave you "${subject}".`,
            relatedTicketId: assignment.ticketId,
          },
        ])
      }
    })
  }
```

The subject lookup sits **outside** the transaction on purpose: SQLite serialises writers, and an interactive transaction holds the write lock for its whole body. Reads that can happen first, happen first.

Every swept ticket was unassigned by the eligibility filter (line 14), so there is no "lost it" recipient — only the gaining agent. The admin who ran the sweep is `actorId`, so an admin who is also a sweep recipient is filtered out of their own notification, which is correct.

---

### 11 — `app/api/admin/audit/route.ts`: the trail endpoint

**Create file: `app/api/admin/audit/route.ts`.** Mirrors `app/api/admin/users/route.ts:8–18`.

```ts
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/api/http"

/** Newest first, capped. Pagination and export are explicitly out of scope. */
const AUDIT_PAGE_SIZE = 100

export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const ticketId = new URL(request.url).searchParams.get("ticketId")

  const logs = await prisma.auditLog.findMany({
    where: ticketId ? { entityType: "Ticket", entityId: ticketId } : {},
    orderBy: { createdAt: "desc" },
    take: AUDIT_PAGE_SIZE,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  })

  return Response.json({ logs })
}
```

`select` names its fields — an `include: { actor: true }` would ship `passwordHash` to the browser.

---

### 12 — `app/api/notifications/`: list and mark-read

**Create file: `app/api/notifications/route.ts`.**

```ts
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api/http"

/** Enough to fill the bell dropdown. `unreadCount` counts all of them, not just these. */
const NOTIFICATION_PAGE_SIZE = 20

export async function GET() {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response
  const { user } = resolved

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        message: true,
        relatedTicketId: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return Response.json({ notifications, unreadCount })
}
```

One request powers the whole bell: the badge count and the dropdown list. `unreadCount` is counted separately from the page so a 21st unread notification still shows in the badge.

**Create file: `app/api/notifications/[id]/route.ts`.**

```ts
import { prisma } from "@/lib/prisma"
import { notFound, readJson, requireUser, validationError } from "@/lib/api/http"
import { markNotificationSchema } from "@/lib/validation/notification"

export async function PATCH(request: Request, ctx: RouteContext<"/api/notifications/[id]">) {
  const resolved = await requireUser()
  if (!resolved.ok) return resolved.response
  const { user } = resolved

  const { id } = await ctx.params

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = markNotificationSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  // Ownership lives **inside the `where`**, the same rule `lib/ticket-access.ts`
  // establishes for tickets: someone else's notification id is
  // indistinguishable from a nonexistent one. No `findUnique` followed by an
  // ownership `if`, and no `403` — a `403` would itself confirm the row exists.
  const { count } = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: parsed.data.read },
  })
  if (count === 0) return notFound("Notification not found.")

  return Response.json({ ok: true })
}
```

---

## Frontend Tasks

### 13 — `components/ui/popover.tsx`

```
npx shadcn@latest add popover --base radix --preset nova
```

Matches `components.json`'s `"style": "radix-nova"`, as `select` and `badge` were added in Story 05. **Verify the generated file imports from the unified `radix-ui` package** (as `components/ui/button.tsx:3` and `components/ui/badge.tsx:3` do) — a generated `@radix-ui/react-popover` import means an unpinned dependency slipped in and must be rewritten to `import { Popover as PopoverPrimitive } from "radix-ui"`.

A popover, not a dropdown-menu: the panel holds a list with its own buttons and links, and menu-item keyboard semantics fight that.

---

### 14 — `lib/notifications.ts` and `lib/audit.ts`: the client modules

**Create file: `lib/notifications.ts`.** Follows `lib/users.ts` exactly.

```ts
import { request } from "@/lib/api/client"
import type { NotificationType } from "@/lib/validation/notification"

/**
 * `createdAt` is a `DateTime` in Prisma but arrives as an ISO **string** —
 * `Response.json` serialises it. Do not type it as `Date`.
 */
export type NotificationItem = {
  id: string
  type: NotificationType
  message: string
  relatedTicketId: string | null
  read: boolean
  createdAt: string
}

export type NotificationFeed = {
  notifications: NotificationItem[]
  unreadCount: number
}

export const notificationKeys = {
  all: ["notifications"] as const,
  feed: () => [...notificationKeys.all, "feed"] as const,
}

export async function fetchNotifications(): Promise<NotificationFeed> {
  return request<NotificationFeed>("/api/notifications")
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await request<{ ok: true }>(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  })
}
```

**Create file: `lib/audit.ts`.**

```ts
import { request } from "@/lib/api/client"
import type { AuditAction } from "@/lib/validation/notification"

export type AuditLogItem = {
  id: string
  entityType: string
  entityId: string
  action: AuditAction
  detail: string
  createdAt: string
  actor: { id: string; name: string; email: string }
}

export const auditKeys = {
  all: ["audit"] as const,
  list: (ticketId?: string) => [...auditKeys.all, "list", ticketId ?? null] as const,
}

export async function fetchAuditLogs(ticketId?: string): Promise<AuditLogItem[]> {
  const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : ""
  const { logs } = await request<{ logs: AuditLogItem[] }>(`/api/admin/audit${query}`)
  return logs
}
```

---

### 15 — `components/agent/notification-bell.tsx` and the sidebar

**Create file: `components/agent/notification-bell.tsx`.**

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { BellIcon } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchNotifications, markNotificationRead, notificationKeys } from "@/lib/notifications"

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: notificationKeys.feed(),
    queryFn: fetchNotifications,
    // Polling, not push — WebSockets and SSE are explicitly out of scope.
    // 30 s, against the comment thread's 8 s
    // (`components/agent/tickets/comment-thread.tsx:29`): a bell is ambient, a
    // thread you are staring at is not. `staleTime: 0` overrides the
    // provider-wide 30 s (`app/providers.tsx:12`) so the first mount after a
    // navigation is fresh. `refetchIntervalInBackground` is **left at its
    // default `false`** — a pinned tab must not poll all night.
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <BellIcon />
          <span>Notifications</span>
          {unreadCount > 0 ? (
            <Badge variant="destructive" className="ml-auto">
              {unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={markRead.isPending}
              onClick={() => {
                for (const item of notifications) {
                  if (!item.read) markRead.mutate(item.id)
                }
              }}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nothing new.</p>
          ) : (
            notifications.map((item) => {
              const body = (
                <div className={item.read ? "opacity-60" : undefined}>
                  <p className="text-sm">{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              )

              return (
                <div key={item.id} className="border-b px-3 py-2 last:border-b-0">
                  {item.relatedTicketId ? (
                    <Link
                      href={`/agent/tickets/${item.relatedTicketId}`}
                      onClick={() => {
                        if (!item.read) markRead.mutate(item.id)
                        setOpen(false)
                      }}
                      className="block hover:underline"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- **"Mark all read" is a loop of `PATCH`es** over the ≤ 20 loaded rows, not a bulk endpoint. The criteria specify one mark-read route; a `PATCH /api/notifications` bulk verb is the follow-up if the count ever grows.
- `size="xs"` is a real `Button` size in this repo — `components/agent/tickets/ticket-table.tsx:186` uses it.
- The query is **unconditional**. A CUSTOMER never renders this component (it lives in the agent sidebar), and a staff member with no notifications gets `{ notifications: [], unreadCount: 0 }`.

**File: `components/agent/sidebar-nav.tsx`** — two edits. Add the audit link to `ADMIN_LINKS` (line 15):

```ts
const ADMIN_LINKS = [
  { href: "/agent/admin/users", label: "Admin" },
  { href: "/agent/admin/audit", label: "Audit" },
] as const
```

…and render the bell above the links by wrapping the existing `<nav>` (lines 21–43):

```tsx
  return (
    <div className="space-y-3">
      <NotificationBell />
      <nav className="flex flex-col gap-1">
        {/* …existing map, unchanged… */}
      </nav>
    </div>
  )
```

The active-link check at lines 24–25 needs **no change**: `/agent/admin/users` and `/agent/admin/audit` are disjoint `startsWith` prefixes.

---

### 16 — `app/agent/admin/audit/page.tsx`

**Create file: `app/agent/admin/audit/page.tsx`.** Mirrors `app/agent/admin/users/page.tsx`.

```tsx
import { AuditTable } from "@/components/agent/admin/audit-table"

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit trail</h1>
      <AuditTable />
    </div>
  )
}
```

**No auth code in this file.** `app/agent/admin/layout.tsx:11` already redirects non-admins, and it wraps every nested route.

---

### 17 — `components/agent/admin/audit-table.tsx`

**Create file: `components/agent/admin/audit-table.tsx`.** The `useQuery` ladder from `components/agent/admin/user-table.tsx` plus the `ALL` sentinel filter from `components/agent/tickets/ticket-table.tsx:22`.

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditKeys, fetchAuditLogs } from "@/lib/audit"
import { fetchTickets, ticketKeys } from "@/lib/tickets"

/** Radix rejects a `SelectItem` with `value=""`, so "no filter" needs a sentinel. */
const ALL = "__all__"

export function AuditTable() {
  const [ticketId, setTicketId] = useState<string | undefined>(undefined)

  const { data: tickets } = useQuery({
    queryKey: ticketKeys.list(),
    queryFn: () => fetchTickets(),
  })

  const { data, isPending, isError, error } = useQuery({
    queryKey: auditKeys.list(ticketId),
    queryFn: () => fetchAuditLogs(ticketId),
  })

  const knownTicketIds = new Set((tickets ?? []).map((ticket) => ticket.id))

  return (
    <div className="space-y-4">
      <Select
        value={ticketId ?? ALL}
        onValueChange={(value) => setTicketId(value === ALL ? undefined : value)}
      >
        <SelectTrigger size="sm" className="w-80">
          <SelectValue placeholder="Filter by ticket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tickets</SelectItem>
          {(tickets ?? []).map((ticket) => (
            <SelectItem key={ticket.id} value={ticket.id}>
              {ticket.subject}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending ? <p className="text-sm text-muted-foreground">Loading activity…</p> : null}

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load activity."}
        </p>
      ) : null}

      {!isPending && !isError && data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : null}

      {!isPending && !isError && data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Ticket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell>{log.detail}</TableCell>
                <TableCell className="text-muted-foreground">{log.actor.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {knownTicketIds.has(log.entityId) ? (
                    <Link href={`/agent/tickets/${log.entityId}`} className="hover:underline">
                      Open
                    </Link>
                  ) : (
                    "deleted"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}
```

The `knownTicketIds` guard is not decoration: `AuditLog.entityId` is not a foreign key (task 2), so a `TICKET_DELETED` row names an id that will 404. Linking it unconditionally ships a broken link from the one page whose job is to be trustworthy.

---

## Edge Cases & Failure Modes

- **An agent claims a ticket themselves.** `describeTicketChanges` produces `CLAIMED`; `assignmentNotifications` produces a `TICKET_ASSIGNED` addressed to that agent; `notify()` **drops it** because `userId === actorId` (`lib/activity.ts`). Result: an audit row and **no** notification. This is a deliberate reading of "notify that agent" — the same self-filter the criteria state explicitly for comments.
- **An admin reassigns a ticket from agent A to agent B.** **Two** notification rows in one transaction — `TICKET_UNASSIGNED` for A, `TICKET_ASSIGNED` for B — plus one `REASSIGNED` audit row. If only one row appears, `assignmentNotifications` is returning early on a `before === null` check it should not have.
- **An admin reassigns a ticket to themselves.** A is notified they lost it; the admin's own `TICKET_ASSIGNED` is filtered. Audit records `REASSIGNED`.
- **The assignee comments on their own ticket.** `notify` drops the only entry — nobody is notified. Enforced in `app/api/tickets/[id]/comments/route.ts` (task 9) by passing `scoped.viewer.id` as the actor.
- **A customer comments on an unassigned ticket.** `assignedAgentId === null`, so the notification array is empty. No row, no error.
- **A `PATCH` that changes nothing** (`{"status":"OPEN"}` on an already-`OPEN` ticket). `describeTicketChanges` compares against `current`, so **zero** audit rows. The response is still `200` with the ticket — Story 05's behaviour is unchanged. Writing a row here would fill the trail with noise on every UI re-save.
- **`{"assignedAgentId": null}` on an already-unassigned ticket.** `patch.assignedAgentId !== before.assignedAgentId` is `false` → no audit row, and `assignmentNotifications` returns `[]` on `before === next`. Two independent guards, on purpose.
- **A notification or audit write throws.** The whole transaction rolls back, so the ticket mutation is undone and the client sees a `500`. **This is the intended trade** — the intake requires both helpers to run "inside the same handler/transaction as the ticket mutation", which necessarily means a logging bug can block ticket work. The compensating control is that both helpers are tiny and take no external input.
- **SQLite write serialisation.** An interactive `$transaction` holds the database write lock for its entire body. Every read a handler can do **before** opening the transaction (the `current` ticket, the target agent, the sweep's subject map) is done before it, and nothing inside a transaction body calls out to anything but `tx`.
- **Interactive transaction timeout.** Prisma's default is 5 s. The sweep (task 10) is the only loop that scales — with a large eligible backlog it can approach it. The sweep is a manual admin action against a demo dataset; if it ever times out, the fix is chunking the loop, **not** moving `logActivity` out of the transaction.
- **A ticket is deleted.** `Notification.relatedTicketId` cascades, so its notifications vanish; the `TICKET_DELETED` `AuditLog` row **survives**, because `entityId` is a plain String. The audit page renders "deleted" instead of a link (task 17). This asymmetry is the whole reason the two models differ.
- **A staff account is deleted.** `AuditLog.actor` is `Restrict` — Prisma raises `P2003` and the delete fails. There is no delete-user endpoint today, so this is a guarantee waiting for a caller. **Do not relax it to `Cascade`**; that would erase history.
- **`PATCH`ing another user's notification.** `updateMany({ where: { id, userId } })` matches nothing → `count === 0` → **`404 "Notification not found."`**, identical to a nonexistent id. **No existence oracle**, and no `403` — a `403` would itself confirm the row exists.
- **`PATCH`ing the same notification read twice.** `count === 1` both times → `200` both times. Idempotent, which is what makes "Mark all read"'s parallel loop safe.
- **A CUSTOMER calls `GET /api/notifications`.** `requireUser()` allows it; the `where` scopes to their `userId`; nothing in this story ever writes a notification to a customer, so they get `{ notifications: [], unreadCount: 0 }` with a `200`. Not a `403` — the endpoint is identity-scoped, not role-scoped.
- **An unauthenticated call to any new route.** `401 {"error":"Unauthorized"}` from `requireUser()` or `requireAdmin()`. `middleware.ts:37` excludes `/api/**`, so there is no ambient protection to fall back on.
- **An AGENT calls `GET /api/admin/audit`.** `403 {"error":"Forbidden"}` from `requireAdmin()`, and `/agent/admin/audit` redirects them to `/agent` via the existing admin layout. Both layers are required.
- **The bell in a background tab.** `refetchIntervalInBackground` stays at its default `false`. **Do not set it to `true`** — same rule as the comment thread.
- **Unread count of zero.** The badge is not rendered at all (`unreadCount > 0` guard), rather than rendering a "0". A permanently visible zero badge trains people to ignore the bell.
- **More than 20 unread notifications.** The dropdown shows the newest 20; the badge shows the true total, because `unreadCount` is a separate `count` query. "Mark all read" then clears only the loaded 20 and the badge drops rather than zeroing — correct, not a bug.
- **An audit `detail` after the actor is renamed.** The stored string keeps the old name; `actor.name` in the table shows the current one. Deliberate: `detail` is a snapshot of the event, `actorId` is the live link.
- **A ticket subject containing quotes.** It is interpolated into `message` inside `"…"`. React escapes it on render; nothing here builds HTML by hand.
- **`RouteContext<"/api/notifications/[id]">` fails to typecheck.** The literal is path-exact and generated by Next. Run `npm run dev` (or `npm run build`) once after creating the route so the types exist, then re-run `npx tsc --noEmit`.

---

## Test Plan

No test runner is installed (`package.json` has no `test` script). These are **manual** checks. Items 4–9 convert directly into unit tests once a runner exists — `describeTicketChanges` and `assignmentNotifications` were written pure for exactly that.

1. **Migration applies** — `npx prisma migrate dev --name add_audit_log_and_notification`, then `npx prisma studio`: `AuditLog` and `Notification` exist with the three indexes; `User`, `Ticket`, `Customer`, `Comment` are **structurally unchanged**. A `new_User` block in the generated SQL means task 2 altered an existing column.
2. **Seed still works** — `npm run seed`, twice. Both succeed. `prisma/seed.ts` is **not** modified by this story and writes no audit or notification rows.
3. **Regression, Story 05 surface** — before touching the bell, walk Story 05's Test Plan items 3–8: claim, release, admin reassign, status change, reopen, and the comment thread. Every one must behave identically, with the same response bodies as before.
4. **Claim writes an audit row and no notification** — as `agent@crm.local`, claim an unassigned ticket. In `prisma studio`: one new `AuditLog` with `action = "CLAIMED"` and `detail` naming the agent; **zero** new `Notification` rows.
5. **Admin assignment notifies the receiving agent** — as `admin@crm.local`, assign an unassigned ticket to `agent@crm.local`. `AuditLog` gains `action = "ASSIGNED"`; `Notification` gains **one** row for that agent with `type = "TICKET_ASSIGNED"` and `read = false`.
6. **Reassignment notifies both sides** — with a second AGENT account, reassign that ticket from A to B as admin. `AuditLog` gains **one** `REASSIGNED` row; `Notification` gains **two** rows — `TICKET_UNASSIGNED` for A, `TICKET_ASSIGNED` for B.
7. **Comment notifies the assignee only** — as `customer@crm.local`, comment on a ticket assigned to agent A. A gains one `TICKET_COMMENTED` notification. Now comment as A on the same ticket: **no** new notification. Now comment as A on an **unassigned** ticket: **no** new notification, no error.
8. **Status and priority changes are logged, no-ops are not** — change status `OPEN → IN_PROGRESS` and priority `LOW → HIGH`: two `AuditLog` rows with before/after values in `detail`. Then `PATCH` `{"status":"IN_PROGRESS"}` again: **no** new row, response still `200`.
9. **Reopen** — close a ticket, then reopen it. `AuditLog` gains `REOPENED`; the assignee (if not the actor) gains a notification.
10. **Sweep** — reproduce Story 05's Test Plan item 11 setup (three back-dated unassigned `HIGH` tickets, two agents with unequal load). Run the sweep as admin: **three** `ASSIGNED` audit rows naming the sweep, and **three** notifications spread across the receiving agents. Run it again: `swept: 0`, and **no** new rows of either kind.
11. **Bell** — sign in as `agent@crm.local` in one browser and `admin@crm.local` in another. Assign a ticket to the agent from the admin browser. The agent's bell badge shows the count **within ~30 s with no reload**. Open the dropdown: the message names the admin and the ticket subject. Watch the network tab: one `GET /api/notifications` roughly every 30 s, and **none** while the tab is backgrounded.
12. **Mark read** — click the notification. It navigates to `/agent/tickets/<id>`, the badge drops by one, and the row shows dimmed on the next open. Reopen the dropdown and click **Mark all read**: the badge disappears.
13. **Audit page** — as `admin@crm.local`, open `/agent/admin/audit`. Rows are newest-first and include everything from items 4–10. Pick a ticket in the filter `Select`: only that ticket's rows remain. Choose **All tickets**: everything returns.
14. **Audit survives deletion** — `DELETE /api/tickets/<id>` as admin (browser console `fetch`). The audit page gains a `TICKET_DELETED` row whose Ticket column reads **"deleted"**, not a link. The ticket's own earlier rows are still listed. Its notifications are **gone** from `prisma studio` — that asymmetry is the point.
15. **API with `curl`** against a running dev server (sign in through the browser and drive these from its console with `fetch`, which sends the session cookie automatically):
    - `GET /api/notifications` with **no cookie** → `401 {"error":"Unauthorized"}`.
    - `GET /api/admin/audit` as **AGENT** → `403 {"error":"Forbidden"}`; as **ADMIN** → `200`.
    - `GET /api/admin/audit?ticketId=<id>` as ADMIN → only that ticket's rows.
    - `GET /api/admin/audit?ticketId=does-not-exist` → `200 {"logs":[]}`.
    - `GET /api/notifications` as **CUSTOMER** → `200 {"notifications":[],"unreadCount":0}`. **Not a `403`.**
    - `PATCH /api/notifications/<another user's notification id>` → **`404 "Notification not found."`** — the same response a made-up id gives.
    - `PATCH /api/notifications/<own id>` with `{"read":true}` twice → `200` both times.
    - `PATCH /api/notifications/<own id>` with `{"read":"yes"}` → `400 "Validation failed"` with `fieldErrors.read`.
    - `PATCH /api/notifications/<own id>` with `not-json` → `400 {"error":"Request body must be valid JSON."}`.
    - **Grep every response body for `passwordHash`. It must not appear** — the audit endpoint joins `User`.
16. **Non-admin cannot reach the page** — as `agent@crm.local`, navigate to `/agent/admin/audit`. Redirected to `/agent`. The sidebar shows **no** "Audit" link for them, and does show it for the admin.
17. **Regression, Stories 02–04** — `/agent/customers` lists and creates; `/agent/admin/users` lists and creates; `/register` creates a linked customer; `/login` routes each role to its home.

---

## Migration / Rollback

- **Back up first:** `cp prisma/dev.db prisma/dev.db.story05.bak` before `migrate dev`. `prisma/dev.db.bak` and `prisma/dev.db.story04.bak` already exist and are untracked — **do not overwrite either**, they are the Story 04 and Story 05 snapshots.
- **Half-applied — schema without migration.** `prisma generate` produces a client with `prisma.auditLog`, and every ticket mutation fails at runtime with "no such table: AuditLog". Because the writes are inside the mutation transaction, **ticket editing stops working entirely** rather than degrading. Tasks 2 and 5 land together, always.
- **Half-applied — helpers without hooks.** The tables exist, the audit page renders "No activity recorded yet." forever, and the bell is permanently empty. Silent, and only Test Plan items 4–10 catch it. Do not stop after task 5.
- **Half-applied — hooks without `notify`'s self-filter.** Every agent gets notified of their own claims and their own comments. The bell becomes noise inside an hour of use. Test Plan items 4 and 7 exist specifically to catch this.
- **Rollback.** Revert the code, then either restore `prisma/dev.db.story05.bak` or run `npx prisma migrate resolve --rolled-back add_audit_log_and_notification` followed by a migration dropping both tables. **No Story 01–05 row is modified by this migration**, so every earlier story keeps working with no data loss.
- **`components/ui/popover.tsx` is independently revertible** — only `components/agent/notification-bell.tsx` imports it.

---

## Verification Steps

1. **Migration applies:** `npx prisma migrate dev --name add_audit_log_and_notification` in the repo root. Read the generated SQL (Test Plan item 1) before committing.
2. **Seed still applies:** `npm run seed` in the repo root, twice. Both runs succeed.
3. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors. Run `npm run dev` once first so Next generates the `RouteContext<"/api/notifications/[id]">` type.
4. **Lint passes:** `npm run lint` in the repo root. Zero errors.
5. **Frontend runs:** `npm run dev`, then walk Test Plan items 4–14 and 16 at `http://localhost:3000`.
6. **Authorization:** Test Plan item 15's request matrix. The `404`-not-`403` on someone else's notification and the `200`-not-`403` for a customer are the two that must not be skipped.
7. **Regression:** Test Plan items 3 and 17. No Story 01–05 response body or redirect may change.
8. **Transaction discipline:** `grep -rn "logActivity\|notify(" app/api` — **every** hit must sit inside a `$transaction` callback and take `tx`, never `prisma`. A single `prisma.auditLog.create` outside a transaction defeats the whole story.
9. **Production build:** `npm run build`. It must succeed — `lib/validation/notification.ts` is imported by both route handlers and client components, so a stray `@/lib/prisma` import there fails here rather than in `dev`.

---

## Done Criteria

- [ ] `AuditLog` exists in `prisma/schema.prisma` with `entityType`, `entityId`, `action`, `actorId` (FK to `User`), `detail`, `createdAt`; `action` is a **String, not a Prisma enum**; **`entityId` is a plain String, not a foreign key**, so a deleted ticket's history survives.
- [ ] `Notification` exists with `userId` (FK to `User`), `type`, `message`, `relatedTicketId` (FK to `Ticket`, **nullable**), `read` (Boolean, **default false**), `createdAt`.
- [ ] A committed migration under `prisma/migrations/` creates both tables and their indexes and **changes no existing column**.
- [ ] `logActivity()` and `notify()` live in `lib/activity.ts`, both **take a `Prisma.TransactionClient` as their first argument**, and every call site runs inside the same `$transaction` as the mutation it records — verified by Verification Step 8.
- [ ] Ticket **status**, **priority**, and **assignment** mutations each write an audit row with a human-readable `detail`; a `PATCH` that changes nothing writes **none**.
- [ ] Story 05's handlers keep their existing authorisation, guards, `select`s, and response bodies — the hooks are additive.
- [ ] `notify()` **never** writes a notification addressed to the actor, which is what implements "notify the assignee, not the comment author".
- [ ] A claim or admin assignment notifies the receiving agent; a reassignment notifies **both** the agent who lost the ticket and the agent who gained it; a new comment notifies the assignee only.
- [ ] `app/agent/admin/audit` lists recent activity newest-first and is **filterable by ticket**, is reachable only by ADMIN (redirect to `/agent` otherwise), and renders **"deleted"** instead of a link for a ticket that no longer exists.
- [ ] `GET /api/notifications` returns the caller's own notifications most-recent-first plus an `unreadCount`, and returns an **empty list with a `200`** for a customer — never a `403`.
- [ ] `PATCH /api/notifications/[id]` is **owner-only via the Prisma `where`**, returning `404` — not `403` — for someone else's id, and is idempotent.
- [ ] `GET /api/admin/audit` is `requireAdmin()`-guarded and its `select` never ships `passwordHash`.
- [ ] The notification bell lives in `components/agent/sidebar-nav.tsx`'s output, shows an unread count only when it is non-zero, opens a dropdown of recent notifications, marks one read on click, and refreshes by **polling on a 30 s `refetchInterval`** with no `setInterval` and no `refetchIntervalInBackground`.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 07.**
