# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/tickets/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Tickets
- **Feature slug (folder under `plans/`):** `tickets`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Ticket CRUD, self-pickup assignment, and comment thread
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Core ticket workflow: unassigned-by-default tickets with self-pickup
claiming, admin-gated reassignment, an admin-triggered assignment
fallback for aging unassigned tickets, a computed SLA-breach indicator,
a near-live-updating comment thread, and customer-scoped portal access
via the Customer.userId link established in story 04.

Assignment model: every new ticket starts unassigned, landing in a
visible unassigned queue. Any agent can claim it. Only the current
assignee or an admin can move it elsewhere — reassigning to a different
named agent is admin-only. An agent creating a ticket directly may
optionally self-assign at creation.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Prisma model `Ticket`: id, subject, description, category, priority
  (`LOW`|`MEDIUM`|`HIGH`, String — not a Prisma enum, SQLite doesn't
  support them, same reasoning as User.role), status
  (`OPEN`|`IN_PROGRESS`|`RESOLVED`|`CLOSED`, String), customerId (FK to
  Customer), assignedAgentId (FK to User, nullable — null means
  unassigned/in the queue), dueAt (nullable datetime), timestamps
- Prisma model `Comment`: id, ticketId (FK), authorId (FK to User), body,
  timestamps
- API: full CRUD for tickets under `app/api/tickets/`, `POST
  /api/tickets/[id]/comments`, `GET /api/tickets/[id]` returns ticket +
  customer + agent + comments
- Assignment authorization on the ticket `PATCH` endpoint, field-level,
  not route-level:
  - Claiming (assignedAgentId: null → self.id) — any AGENT or ADMIN
  - Releasing (self.id → null) — the current assignee, or an ADMIN
  - Reassigning to a different specific agent (X.id → Y.id, Y != self) —
    ADMIN only; a non-admin attempting this gets 403
- Admin-triggered assignment fallback: `POST /api/tickets/assign-sweep`
  (`requireAdmin()`-guarded) claims every unassigned ticket whose SLA
  window is more than half elapsed, assigning each to whichever AGENT
  currently has the fewest open tickets. Manual admin action, not a
  scheduled job
- Comment thread on the ticket detail page refetches on an 8–10s
  `refetchInterval` while the page is open
- Server-side guard: a `CLOSED` ticket needs an explicit reopen action to
  move back to `OPEN`
- Computed SLA-breach flag: `dueAt < now() AND status NOT IN (RESOLVED,
  CLOSED)` — no stored column, calculated at read time
- Customer-scoped access: a logged-in CUSTOMER may only view/comment on
  tickets whose `Ticket.customerId` points to the Customer record where
  `Customer.userId === session.user.id`. A CUSTOMER whose account has no
  linked Customer record (should not happen post-registration-story, but
  handle it defensively) → empty ticket list, not an error. Agents
  bypass this check entirely
- Seed script extended: one demo ticket linked to the Customer record
  already seeded and linked to `customer@crm.local` in story 04 — no
  new email-matching logic needed here
- `app/agent/tickets` — list with filters for status, priority, and
  "assigned to me"; unassigned tickets show a Claim action; admin-only
  "Run assignment sweep" button
- `app/agent/tickets/[id]` — info panel, status/priority controls,
  claim/release/reassign controls (reassign-to-other-agent only rendered
  for admins), SLA-breach indicator, live-refetching comment thread
- `app/agent/tickets/new` — create form, linked to an existing customer,
  optional "assign to me" checkbox
- `app/portal/tickets` — customer-facing: submit, view own, comment
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold (auth, layout), story 02-customers (Customer model, requireAgent(), typegen route-param pattern), story 03-admin (requireAdmin() and isStaff() for assignment authorization and the sweep endpoint), story 04-registration (Customer.userId must already exist and be populated — do not fall back to an email match if this dependency is missing, flag it instead)

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Reuse requireAgent() from story 02 for agent-only routes. The assignment authorization logic is field-level — inspect what's actually changing on assignedAgentId against session.user.id/role, not just gate the whole handler. The customer-ownership check for portal routes should query via Customer.userId, a direct equality check, not a string comparison. Prisma is pinned to 6.19.3. Use the RouteContext<...>/PageProps<...> + await params pattern from story 02. If new shadcn components are needed (Select, Badge), expect `--base radix --preset nova`. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Real email/WhatsApp/SMS delivery, AI-suggested replies or auto-categorization, true scheduled/background automatic assignment (the sweep endpoint is manually triggered), real-time push (WebSockets) for the comment thread, real-time alerts/notifications (a separate story), audit logging of these actions (a separate story), CSAT/feedback (a separate story)
