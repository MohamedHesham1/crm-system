# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customers/customer-interaction-history-and-ticket-timeline/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer history
- **Feature slug (folder under `plans/`):** `customers`

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
Customer interaction history and ticket timeline
```
Show staff unified customer ticket history and chronological ticket timeline
using existing ticket, comment, and audit data.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Customer detail lists the customer's non-deleted tickets, newest first, with
  subject, status, priority, creation date, and assignee.
- Staff can inspect a ticket timeline containing audit events, comments, and
  internal notes in chronological order with actor and timestamp.
- History and timeline APIs require staff access and scope results to the
  requested customer/ticket. Soft-deleted tickets are excluded.
- Customer portal responses never include internal notes or staff-only audit
  details.
- New API routes use `withAuth`; tests under `tests/api/` and
  `tests/components/`; `npm test` passes.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Customer detail lists non-deleted tickets newest first with subject, status,
  priority, creation date, and assignee.
- Staff can inspect chronological ticket timelines containing audit events,
  comments, and internal notes with actor and timestamp.
- History and timeline APIs require staff access and scope results to the
  requested customer or ticket; soft-deleted tickets are excluded.
- Customer portal responses never expose internal notes or staff-only audit
  details.
- New routes use `withAuth`; tests under `tests/api/` and
  `tests/components/`; `npm test` passes.
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
- **Depends on code areas or other stories:** Stories 02, 05, 06, 09, and 13.
  Reuse customer, ticket, comment, audit, and private-note models. Implement
  after Story 13.

## Extra notes (optional)

Staff-only history feature. Keep portal payloads unchanged.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Attachments, exports, real-time push, or changing audit writers
  - Exposing private notes or audit detail to customers
