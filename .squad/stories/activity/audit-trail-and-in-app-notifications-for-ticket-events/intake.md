# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/activity/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Activity
- **Feature slug (folder under `plans/`):** `activity`

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
Audit trail and in-app notifications for ticket events
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Two small subsystems on the same event-logging pattern: an admin-only
audit trail of ticket changes, and a per-agent notification bell. Both
hook into story 05's mutation points without modifying that story's core
logic.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Prisma model `AuditLog`: id, entityType (String, e.g. "Ticket"),
  entityId, action (String, e.g. "STATUS_CHANGED", "CLAIMED",
  "REASSIGNED"), actorId (FK to User), detail (String, human-readable
  summary), createdAt
- `logActivity()` helper called from story 05's ticket status, priority,
  and assignment mutation handlers — extends those handlers, does not
  rewrite their existing logic
- `app/agent/admin/audit` — admin-only page listing recent activity,
  filterable by ticket
- Prisma model `Notification`: id, userId (FK to User, recipient), type
  (String), message, relatedTicketId (FK to Ticket, nullable), read
  (Boolean, default false), createdAt
- `notify()` helper called on: a ticket being claimed/assigned (notify
  that agent), a new comment on a ticket the recipient is assigned to
  (notify the assignee, not the comment author), a ticket reassigned
  away from an agent (notify the agent who lost it and the one who
  gained it)
- Notification bell in the agent sidebar (extends
  components/agent/sidebar-nav.tsx, same file story 03 already touched
  to add the Admin link) showing an unread count and a dropdown of
  recent notifications
- `PATCH /api/notifications/[id]` — mark as read, owner-only
- `GET /api/notifications` — list the current user's notifications,
  most recent first
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 03-admin (requireAdmin() for the audit page) and story 05-tickets (ticket/comment mutation handlers this story hooks into must already exist)

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Both logActivity() and notify() should be called from inside the same handler/transaction as the ticket mutation they're recording, not as a separate follow-up request. Notifications are agent-facing only for this story — customers do not get an in-app notification surface. Prisma is pinned to 6.19.3. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Real-time push (WebSocket/SSE) for notifications — polling or on-navigation refresh only, email/SMS notification delivery, notification preferences/settings, audit log export or retention policy, customer-facing notifications