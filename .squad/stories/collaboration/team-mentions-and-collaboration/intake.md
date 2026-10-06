# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/collaboration/team-mentions-and-collaboration/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Team collaboration
- **Feature slug (folder under `plans/`):** `collaboration`

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
Team mentions and collaboration
```
Allow staff to mention other staff members in ticket comments and internal
notes. Mentioned staff receive an in-app notification linked to the ticket.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Staff can select one or more AGENT/ADMIN accounts when writing a comment or
  internal note. Server validates every selected recipient.
- Mentioned staff receive one in-app notification per comment; author receives
  no self-notification and duplicate ids are collapsed.
- Notification links to ticket and appears in existing bell.
- Customers cannot mention staff or receive staff-only mention metadata or
  private notes.
- Existing comment visibility and ticket ownership checks remain unchanged.
  Routes use `withAuth`; tests live under `tests/api/` and `tests/components/`.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Staff can mention AGENT/ADMIN accounts in ticket comments and internal notes;
  server validates each recipient.
- Each mentioned staff member receives one in-app notification per comment.
  No self-notifications; duplicate recipient ids are collapsed.
- Notification links to ticket and appears in existing bell.
- Customers cannot mention staff or receive staff-only mention metadata or
  private notes.
- Existing comment visibility and ticket ownership checks remain unchanged.
  Routes use `withAuth`; tests live under `tests/api/` and `tests/components/`.
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
- **Depends on code areas or other stories:** Stories 06, 09, and 13. Reuse
  internal-note visibility, comment API, notifications, and bell. Implement
  after Story 13.

## Extra notes (optional)

Only staff accounts may be mentioned. In-app notification only.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Presence, direct messages, group chat, email, or WebSockets/SSE
  - Mentions in customer-authored comments
