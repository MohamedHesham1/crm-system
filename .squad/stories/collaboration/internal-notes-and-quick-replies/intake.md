# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/collaboration/internal-notes-and-quick-replies/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent collaboration
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
Internal notes and quick replies
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Add private internal notes to the existing ticket conversation without
exposing them to customers, and give staff a small set of canned quick
replies that can be inserted into the existing comment composer. Preserve
the current public-comment flow and the shared agent/portal comment thread.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Staff can create either a public comment or an internal note from the
  existing ticket conversation. Internal notes are visibly distinguished
  in the staff thread and display their author and timestamp.
- A CUSTOMER can never create or read an internal note, including by calling
  the comments API directly. The customer-facing GET response excludes
  internal notes; attempts by a customer to submit an internal note are
  rejected. Existing public comments remain visible to the ticket's customer.
- The comment record stores whether it is internal with a database default
  that preserves existing comments as public. The database change is delivered
  as a Prisma SQLite migration.
- The staff composer exposes a Quick replies control with built-in replies.
  Choosing a reply inserts its text after any existing draft (with a line
  break when needed); it does not discard the draft, post, or change a
  comment's visibility automatically.
- The Quick replies control and internal-note option are not available in the
  customer portal. Portal users retain the current public-only comment flow.
- Every new API behavior remains behind the route's explicit `withAuth`
  declaration; existing ticket ownership checks still apply to both comment
  reads and writes.
- Add regression tests under `tests/api/` and `tests/components/`. The complete
  existing suite must pass with `npm test`.
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
- **Depends on code areas or other stories:** Story 05, which introduced
  `Comment`, `createCommentSchema`, the scoped comments API, and the shared
  `CommentThread`; Story 09, which established the Vitest suite and test
  helpers. Preserve the customer ownership checks and public comment response
  shape from those stories.

## Extra notes (optional)

Quick replies are built-in and not user-configurable in this story. Internal
notes are staff-only collaboration messages, not audit entries or customer
notifications.

## Technical hints (optional)

- Extend the existing `Comment` model and comment API instead of creating a
  second message system. Keep agent and portal conversation rendering on the
  shared `components/agent/tickets/comment-thread.tsx` surface and apply
  visibility filtering on the server.
- Reuse the existing comment validation and ticket access helpers. Do not
  trust client-side hiding as authorization.
- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Editing, deleting, or managing quick-reply templates
  - @mentions, assignments, presence, WebSockets/SSE, or team chat
  - File attachments or rich-text editing
  - Customer access to internal notes
  - Changes to ticket assignment, statuses, SLA rules, or notifications
