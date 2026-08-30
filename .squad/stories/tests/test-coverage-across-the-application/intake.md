# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/tests/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Tests
- **Feature slug (folder under `plans/`):** `tests`

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
Test coverage across the application
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Focused test coverage on the critical paths built in stories 02–08.
Quality over exhaustiveness — this is a time-boxed project, not a
production suite.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Vitest + React Testing Library configured and runnable via `npm run test`
- API route tests: create + list customers (happy path + one validation
  failure); register with a new email creates a linked Customer+User;
  register with an email matching an unlinked Customer links via userId
  instead of creating a duplicate; duplicate-email registration rejected;
  create + assign + change status on a ticket (happy path + one invalid-
  transition case); a non-admin agent reassigning to a different agent
  gets 403; an admin performing the same reassignment gets 200; the
  assignment sweep claims an eligible aging ticket; an audit log entry is
  written on a status change; a notification is created on assignment;
  a sweep-triggered assignment produces an audit log entry the same as a
  manual claim does; a sweep-triggered assignment notifies the assigned
  agent the same as a manual claim does; a failed sweep rolls back cleanly
  with no orphaned audit or notification rows for assignments that never
  actually happened; feedback submission is rejected on a non-resolved
  ticket and accepted on a resolved one
- Component tests: ticket status-change control behaves correctly;
  customer create form shows validation errors on bad input; dashboard
  SLA-breach badge renders correctly for a breached vs. non-breached
  ticket; notification bell unread count updates after marking one read
- Target 16–20 tests total, all passing
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** stories 02, 03, 04, 05, 06, 07, and 08 must all be executed first

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Test against the actual API routes and components built in stories 02–08 — don't restructure existing code to make it "more testable" as part of this story; flag it in the plan as a follow-up if something is genuinely untestable as written. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - End-to-end/browser tests (Playwright etc.), coverage-percentage targets, testing the FAQ/report stub pages pixel-precisely
