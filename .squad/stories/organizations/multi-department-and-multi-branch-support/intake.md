# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/organizations/multi-department-and-multi-branch-support/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Departments and branches
- **Feature slug (folder under `plans/`):** `organizations`

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
Multi-department and multi-branch support
```
Add department and branch structure, staff membership, ticket assignment, and
server-enforced data scoping while preserving single-team behavior.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Admin can create, edit, deactivate, and list departments and branches with
  unique validated names and stable ids.
- Admin assigns staff to departments and branches; tickets can be assigned to
  an organizational scope.
- Staff ticket lists, details, APIs, dashboards, reports, search, and alerts
  obey membership scope. Admin retains organization-wide access; customer
  access remains scoped to owned customer profile/tickets.
- Migration assigns all existing data to one default department and branch
  without losing ownership, roles, audit, or notification history.
- Every route uses `withAuth`; tests verify cross-scope denial and admin
  access.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Admin can create, edit, deactivate, and list departments and branches with
  unique validated names and stable ids.
- Admin assigns staff to departments/branches; tickets can be assigned to an
  organizational scope.
- Staff ticket lists/details, APIs, dashboards, reports, search, and alerts
  obey membership scope. Admin retains organization-wide access; customer
  access remains scoped to owned customer profile/tickets.
- Migration assigns existing data to one default department and branch without
  losing ownership, roles, audit, or notification history.
- Every route uses `withAuth`; tests verify cross-scope denial and admin access.
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
- **Depends on code areas or other stories:** Stories 05–09, 20, and 21.
  Complete configurable settings and granular permissions first; audit every
  ticket, dashboard, report, notification, and search query for scope.

## Extra notes (optional)

One default department/branch preserves existing single-team behavior.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Cross-tenant SaaS isolation, branch branding, or external identity sync
