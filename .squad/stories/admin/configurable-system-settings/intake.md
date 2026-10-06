# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/admin/configurable-system-settings/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** System configuration
- **Feature slug (folder under `plans/`):** `admin`

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
Configurable system settings
```
Move ticket categories and SLA response/resolution targets from hardcoded
constants into admin-managed settings. Existing ticket deadlines remain
unchanged when settings change.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Admin can list, add, rename, deactivate, and order ticket categories.
  Historical tickets retain old category text; deactivated categories cannot
  be selected on new tickets.
- Admin can edit positive, bounded per-priority response/resolution hour
  targets. Invalid values return field errors.
- New settings affect new tickets and future SLA evaluation only by explicit
  rule; existing `dueAt` is never silently recalculated.
- Empty settings DB preserves current behavior; defaults match existing
  categories and SLA values.
- Settings routes use `withAuth({ role: "admin" })`; admin page inherits
  existing admin layout.
- Tests cover access, validation, defaults, and new ticket behavior.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Admin can list, add, rename, deactivate, and order ticket categories.
  Historical tickets retain category text; inactive categories cannot be
  selected for new tickets.
- Admin can edit positive, bounded response/resolution hour targets per
  priority; invalid values return field errors.
- Existing `dueAt` values are never silently recalculated when settings change.
- Empty settings DB preserves current behavior; defaults match existing
  categories and SLA values.
- Settings routes use `withAuth({ role: "admin" })`; page inherits admin layout.
- Tests cover access, validation, defaults, and new-ticket behavior.
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
- **Depends on code areas or other stories:** Stories 03, 05, 07, and 09.
  Reuse admin authorization, ticket category validation, and SLA helpers.
  Initially admin-only; granular permissions remain separate.

## Extra notes (optional)

Seed defaults to match current behavior; do not change existing deadlines.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Branding, departments/branches, arbitrary app configuration, or migration
    of existing `dueAt` values
