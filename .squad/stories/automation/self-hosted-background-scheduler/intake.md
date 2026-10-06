# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/automation/self-hosted-background-scheduler/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Self-hosted automation
- **Feature slug (folder under `plans/`):** `automation`

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
Self-hosted background scheduler
```
Provide optional self-hosted worker for assignment sweeps, SLA-breach alerts,
due-task reminders, and configured escalation rules without hosted cron.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Worker runs as separate documented process using shared app/domain code and
  DB; it is never started in every Next.js web process.
- Admin enables supported jobs and configures bounded schedules and
  escalation rules through validated settings.
- Worker runs assignment, SLA alert, and due-task jobs using shared domain
  logic, not unauthenticated HTTP calls.
- Durable leases/idempotency prevent duplicate work after restart, retries,
  or multiple workers.
- Job outcomes and failures are visible in safe structured logs without
  secrets or customer message bodies; failures remain retryable.
- Document command, environment, graceful shutdown, health, and multi-instance
  operation.
- Tests cover job selection, retries, disabled jobs, idempotency, and lock
  contention; `npm test` and build pass.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Worker runs as a separate documented process using shared app/domain code
  and DB; it never starts in every Next.js web process.
- Admin enables supported jobs and configures bounded schedules and
  escalation rules through validated settings.
- Assignment, SLA alert, and due-task jobs use shared domain logic, not
  unauthenticated HTTP calls.
- Durable leases/idempotency prevent duplicate work after restart, retries, or
  multiple workers.
- Safe structured logs show job outcomes/failures without secrets or customer
  message bodies; failures remain retryable.
- Document command, environment, graceful shutdown, health, and multi-instance
  operation.
- Tests cover job selection, retries, disabled jobs, idempotency, and lock
  contention; `npm test` and build pass.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** Stories 06, 14, 17, 20, and 21.
  Reuse notification, SLA alert, task reminder, settings, and permissions
  contracts.

## Extra notes (optional)

Story 14's secured cron endpoint remains supported alongside local worker.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Redis, cloud queues, hosted cron, message channels, or arbitrary scripts
