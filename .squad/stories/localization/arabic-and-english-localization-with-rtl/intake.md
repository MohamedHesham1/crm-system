# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/localization/arabic-and-english-localization-with-rtl/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Arabic and English
- **Feature slug (folder under `plans/`):** `localization`

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
Arabic and English localization with RTL
```
Add user-selectable Arabic and English with RTL layout for Arabic. Preserve
English as default and never translate user-authored database content.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Users select English or Arabic with persistent preference; existing users
  default to English and unauthenticated portal visitors can choose either.
- Application-owned navigation, forms, validation, notifications, states, and
  core pages use complete translation dictionaries.
- Arabic sets document `lang="ar"` and `dir="rtl"`; English uses `lang="en"`
  and `dir="ltr"`. Forms, tables, dialogs, charts, icons remain usable.
- User-authored names, subjects, comments, and articles remain unchanged and
  render with bidirectional isolation where needed.
- Locale preference never affects authorization or ownership.
- Tests cover persistence, dictionary completeness, document direction, and
  critical portal/agent screens.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Users can select English or Arabic with persistent preference. Existing
  users default to English; unauthenticated portal visitors can choose either.
- Application-owned navigation, forms, validation, notifications, states, and
  core pages use complete translation dictionaries.
- Arabic sets document `lang="ar"` and `dir="rtl"`; English sets `lang="en"`
  and `dir="ltr"`. Forms, tables, dialogs, charts, and icons remain usable.
- User-authored names, subjects, comments, and articles remain unchanged and
  use bidirectional isolation where needed.
- Locale preference never affects authorization or ownership.
- Tests cover persistence, dictionary completeness, document direction, and
  critical portal/agent screens.
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
- **Depends on code areas or other stories:** Stories 09, 10, 12, 19, and 27.
  Reuse theme/responsive patterns; include knowledge-base surfaces and
  configurable brand strings.

## Extra notes (optional)

Default locale English. Do not machine-translate database content.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Machine translation, additional locales, localized currency, or
    translation-management UI
