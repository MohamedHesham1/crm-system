# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/escalation/ticket-escalation-status-and-sla-breach-alerts/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket escalation
- **Feature slug (folder under `plans/`):** `escalation`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Ticket escalation status and SLA breach alerts
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Give staff an explicit ESCALATED ticket status and notify the currently
assigned staff member when an active ticket breaches its SLA. The application
has no scheduler today, so expose a platform-neutral, token-protected cron
endpoint that a deployment scheduler can invoke. Continue to use the existing
computed SLA rules and in-app notification bell.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- `ESCALATED` is a valid ticket status and is selectable by staff from the
  existing ticket status control. It appears consistently in ticket details,
  status filters, dashboard summaries, reports, and status badges.
- `ESCALATED` remains a live, non-terminal status: it does not stop the SLA
  clock, clear `dueAt`, or count as resolved/closed. Existing closed-ticket
  protections remain in force.
- Add `SLA_BREACHED` to the existing notification type contract. When a
  scheduled invocation finds a non-deleted ticket past its SLA deadline, it
  creates an in-app notification for that ticket's currently assigned staff
  member. An unassigned ticket creates no recipient notification.
- Repeated cron invocations do not create duplicate SLA-breach notifications
  for the same ticket, recipient, and due date. Changing the assigned recipient
  or SLA due date allows the new recipient/deadline to receive its own alert.
- Add `POST /api/cron/sla-alerts`, wrapped in `withAuth` with an explicit
  public role and protected by a required `CRON_SECRET` bearer token. Missing
  configuration or an invalid token fails closed; the handler processes only
  overdue, non-terminal, non-deleted tickets with an assigned staff member.
- Document the endpoint, required secret, and expected bearer-token request
  for a platform deployment scheduler. Provisioning a particular scheduler is
  not part of this repository change.
- Add tests under `tests/api/`, `tests/components/`, and the applicable
  validation/library test location. The full existing suite must pass with
  `npm test`.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
None.

---

## Dependencies

- **Blocked by / related ids:** none (tracker type is `none`)
- **Depends on code areas or other stories:** Story 05 for the canonical ticket
  status and SLA helpers; Story 06 for `Notification`, `notify()`, and the
  in-app notification bell; Story 13 (internal notes and quick replies) must
  be completed first so Prisma schema migrations and shared ticket/comment
  surfaces are integrated in sequence. Story 09 supplies the Vitest test
  baseline.

## Extra notes (optional)

Notify only the ticket's currently assigned staff member. If no staff member
is assigned, skip notification delivery; do not notify every admin or all
staff.

## Technical hints (optional)

- Reuse `lib/sla.ts` for breach semantics and the existing `Notification`
  model/client/bell for delivery. Add a durable uniqueness key for breach
  notifications so repeated scheduler requests are idempotent.
- The cron endpoint is platform-neutral and is invoked externally with
  the configured `CRON_SECRET` bearer token. Keep every route wrapped with
  `withAuth`; the explicit `"public"` wrapper does not replace the secret
  check.
- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Provisioning or configuring Vercel Cron, a self-hosted worker, or another
    vendor-specific scheduler
  - Email/SMS/WhatsApp delivery, near-breach alerts, escalation rules or
    automatic reassignment
  - SLA configuration UI or changing the existing priority-based SLA targets
  - Notifications for unassigned tickets or broadcasts to all staff
  - Changes to the customer comment visibility rules from Story 13
