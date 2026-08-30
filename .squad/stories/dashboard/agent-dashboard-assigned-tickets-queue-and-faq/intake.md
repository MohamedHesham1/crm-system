# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/dashboard/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Dashboard
- **Feature slug (folder under `plans/`):** `dashboard`

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
Agent dashboard: assigned tickets, queue, and FAQ
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
The agent's operational landing page: what's assigned to them, what's
waiting in the unassigned queue, and a static FAQ page for the portal.
No charts or aggregate reporting here — that's a separate story.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- `app/agent/dashboard` — tickets assigned to the current agent, quick
  counts by status, and a separate "unassigned queue" count so agents can
  see at a glance whether work is waiting to be claimed
- SLA-breach badge reused from story 05's computed flag, shown on
  relevant ticket rows
- `app/portal/faq` (or `app/help`) — static FAQ page, 5–8 hardcoded
  Q&A entries, no database table needed for this
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 02-customers and story 05-tickets — this is a composition story with no new core data models, and reuses the SLA-breach logic from story 05 rather than reimplementing it

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Read from the Ticket/Customer models built in stories 02 and 05. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Any chart or aggregate reporting (a separate story), proactive SLA escalation/notifications, dynamic/searchable knowledge base, any AI-generated content on the FAQ page
