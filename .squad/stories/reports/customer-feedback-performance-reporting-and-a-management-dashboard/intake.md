# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/reports/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reports
- **Feature slug (folder under `plans/`):** `reports`

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
Customer feedback, performance reporting, and a management dashboard
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Customer feedback capture on resolved tickets, plus the analytical
reporting layer: ticket counts by status/priority, SLA performance,
per-agent performance, and CSAT — composed into one management
dashboard page. Everything here reads existing data except the feedback
submission itself.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Prisma model `Feedback`: id, ticketId (FK, unique — one feedback per
  ticket), rating (Int, 1-5), comment (String, optional), createdAt
- `POST /api/tickets/[id]/feedback` — customer-owner-only (via
  Customer.userId, same pattern as story 05's ticket access), only
  allowed when ticket status is RESOLVED or CLOSED and no feedback
  exists yet for it
- Portal: a feedback prompt shown on `app/portal/tickets/[id]` when the
  ticket is resolved/closed and unrated
- `app/agent/reports` — composed page with:
  - Ticket counts by status and by priority (recharts)
  - SLA performance: % of tickets resolved within their `dueAt` target,
    average resolution time
  - Agent performance (admin-only section): tickets resolved per agent,
    average resolution time per agent
  - CSAT summary: average rating, total feedback count
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 03-admin (agent performance section is admin-gated), story 05-tickets (all reporting reads Ticket data; this story also owns the new Feedback model)

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Agent performance section should check requireAdmin() at the component or route level, not just visually hide it — regular agents should get a 403 if they hit the underlying data endpoint directly. Feedback ownership check uses Customer.userId. Prisma is pinned to 6.19.3. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Exporting reports (CSV/PDF), scheduled/emailed report delivery, historical trend charts (point-in-time snapshots only), feedback moderation or response, customer satisfaction surveys beyond the single post-resolution rating
