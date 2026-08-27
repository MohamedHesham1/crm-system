# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customers/customer-profiles-model-api-and-management-ui/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customers
- **Feature slug (folder under `plans/`):** `customers`

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
Customer profiles: model, API, and management UI
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Customer management on top of the scaffold from story 01. Prisma model,
CRUD API under `app/api/customers/`, and agent-facing pages under
`app/agent/customers/`.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Prisma model `Customer`: id, name, email, phone, company (optional),
  notes (text), timestamps, relation to `Ticket[]` (ticket model arrives
  in story 03 — just leave the relation field ready)
- API: `GET /api/customers` (list), `GET /api/customers/[id]`,
  `POST /api/customers`, `PATCH /api/customers/[id]` — agent-only,
  Zod-validated request bodies, proper 4xx on invalid input
- `app/agent/customers` — table of customers (name, email, phone)
- `app/agent/customers/[id]` — profile detail with editable notes field
- `app/agent/customers/new` — create form with client + server validation,
  inline error messages on invalid fields
- Data fetching via TanStack Query, matching the pattern established in
  story 01's layout code
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold — Prisma client, Auth.js session helpers, route groups, and base layout must already exist

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Reuse the auth/session helpers and route-group structure from story 01 — don't re-implement role checking. Prisma is pinned to 6.19.3 (both `prisma` and `@prisma/client`) — do not let this story upgrade either package to `latest`. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- File/attachment upload on customer notes, customer self-service editing of their own profile (agent-managed only for the MVP)
