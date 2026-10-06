# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/branding/configurable-custom-branding/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Custom branding
- **Feature slug (folder under `plans/`):** `branding`

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
Configurable custom branding
```
Replace fixed brand with admin-configurable organization name, logo/wordmark,
and approved colors while preserving accessible light/dark themes.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Admin edits organization display name, logo, and approved primary/accent
  colors in branding settings.
- Brand appears consistently in agent/portal navigation, auth pages, metadata,
  and printable reports.
- Logo uses Story 16 local persistent storage; accept safe raster formats
  only. Never allow uploaded SVG or arbitrary CSS/HTML.
- Validate contrast in light and dark themes; reject unreadable colors.
- Defaults preserve shipped branding. Settings are installation-wide, with no
  per-customer or per-branch leakage.
- Admin-only API uses `withAuth`; tests cover defaults, auth, asset validation,
  contrast, and rendered surfaces.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Admin can edit organization display name, logo, and approved primary/accent
  colors in branding settings.
- Branding appears consistently in agent/portal navigation, auth pages,
  metadata, and printable reports.
- Logo uses Story 16 local persistent storage and safe raster formats only;
  SVG, arbitrary CSS, and HTML are rejected.
- Contrast is validated for light and dark themes; unreadable colors are
  rejected.
- Defaults preserve shipped branding. Settings are installation-wide, without
  per-customer or per-branch leakage.
- Admin-only API uses `withAuth`; tests cover defaults, auth, asset validation,
  contrast, and rendered surfaces.
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
- **Depends on code areas or other stories:** Stories 10, 12, 16, and 20.
  Reuse theme tokens, responsive nav, local storage, and settings service.

## Extra notes (optional)

Brand applies to installation, not individual branches/customers.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Per-tenant branding, custom CSS, arbitrary HTML, or third-party logo hosts
