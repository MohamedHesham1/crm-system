# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-tools/agent-tasks-and-reminders/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent tasks
- **Feature slug (folder under `plans/`):** `agent-tools`

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
Agent tasks and reminders
```
Let staff create follow-up tasks tied to tickets/customers, track due dates,
and receive in-app reminders through the notification bell.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Staff can create, edit, complete, and delete own tasks; admins can manage
  staff tasks. Tasks may link to one ticket and one customer.
- Validate required title and optional description/due date. Completed tasks
  remain visible in history and never trigger reminders.
- Agent dashboard shows upcoming/overdue tasks and links to complete task list.
- Due/overdue tasks are identified using server time; Story 28's worker
  dispatches at most one in-app reminder per due occurrence, including after
  retries.
- Task APIs enforce ownership on every request and use `withAuth`.
- Tests under `tests/api/` and `tests/components/`; full `npm test` passes.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Staff can create, edit, complete, and delete own tasks; admins can manage
  staff tasks. Tasks link to at most one ticket and one customer.
- Title is required; description and due date are optional and validated.
  Completed tasks remain visible and never trigger reminders.
- Agent dashboard shows upcoming and overdue tasks and links to full task list.
- Due and overdue state uses server time. Story 28 worker sends at most one
  in-app reminder per due occurrence, including after retries.
- Task APIs enforce ownership on every request and use `withAuth`.
- Tests under `tests/api/` and `tests/components/`; `npm test` passes.
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
- **Depends on code areas or other stories:** Stories 02, 06, 07, 09, and 28.
  Story 28 supplies scheduled reminder delivery. Build task CRUD/list first;
  deliver reminders after scheduler is available.

## Extra notes (optional)

In-app reminders only. Non-admins cannot assign tasks to other staff.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Email/SMS/WhatsApp, recurring schedules, task templates, calendar sync, or
    non-admin cross-agent assignment
