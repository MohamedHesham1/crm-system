# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/permissions/granular-role-based-permissions/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Granular permissions
- **Feature slug (folder under `plans/`):** `permissions`

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
Granular role-based permissions
```
Add explicit, testable staff permissions while preserving AGENT, ADMIN, and
CUSTOMER roles and current authorization behavior through a default matrix.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Define a typed permission catalog and shared server-side authorization
  helper used by migrated API routes and admin pages.
- Default matrix preserves behavior: ADMIN has all staff capabilities, AGENT
  has current agent capabilities, CUSTOMER has no staff capability.
- Admin can grant/revoke supported permissions for staff only. Users cannot
  grant permissions to self or modify admin privileges.
- Migrate routes explicitly; unmigrated routes preserve current behavior.
  Missing, malformed, or unknown permission data grants nothing.
- Permission changes are recorded in existing audit trail.
- Every route uses `withAuth`; test defaults, deny/grant, admin protection,
  and audit writes.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Typed permission catalog and shared server-side authorization helper are
  used by migrated API routes and admin pages.
- Default matrix preserves behavior: ADMIN has all staff capabilities, AGENT
  has current agent capabilities, CUSTOMER has no staff capability.
- Admin can grant/revoke supported permissions for staff only; users cannot
  grant permissions to self or modify admin privileges.
- Migrated routes enforce permissions; unmigrated routes preserve behavior.
  Missing, malformed, or unknown permission data grants nothing.
- Permission changes are recorded in existing audit trail.
- Every route uses `withAuth`; tests cover defaults, allow/deny, admin
  protection, and audit writes.
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
- **Depends on code areas or other stories:** Stories 03, 06, and 09.
  Preserve fixed-role behavior by default. Complete before department scoping
  in Story 26 and account lifecycle permission expansion.

## Extra notes (optional)

Roll out least privilege incrementally; existing agents must not lose current
capabilities.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Customer-defined rules, arbitrary policy expressions, SSO, or
    department/branch record scoping
