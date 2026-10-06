# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/knowledge-base/knowledge-base-articles-guides-and-search/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Knowledge base
- **Feature slug (folder under `plans/`):** `knowledge-base`

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
Knowledge base articles, guides, and search
```
Provide searchable help articles and guides using existing FAQ as a starting
point. Staff manage published content; customers search and read published
articles from portal.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Staff with content-management permission can create, edit, publish,
  unpublish, and archive articles with title, slug, summary, body, and
  category.
- Customers search/read published articles only; drafts and archived articles
  never appear in APIs, detail routes, or search results.
- Search matches title, summary, body, and category; validates query length
  and paginates bounded results.
- Existing FAQ remains reachable and links to curated knowledge-base content
  without breaking portal behavior.
- New routes use `withAuth`; customer reads explicitly constrain published
  records. Tests under `tests/api/` and `tests/components/`.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Staff with content-management permission can create, edit, publish,
  unpublish, and archive articles with title, slug, summary, body, and category.
- Customers search and read published articles only; drafts and archived
  content never appear in APIs, detail routes, or search results.
- Search covers title, summary, body, and category; query length is validated
  and results are paginated with a bound.
- Existing FAQ remains reachable and links to curated knowledge-base content
  without breaking portal behavior.
- New routes use `withAuth`; customer reads explicitly constrain published
  records. Tests under `tests/api/` and `tests/components/`.
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
- **Depends on code areas or other stories:** Stories 03, 07, and 09. Reuse
  admin authorization and portal navigation. Article category is managed
  within the knowledge base; system-wide categories remain Story 20.

## Extra notes (optional)

Use SQLite search; no hosted search service.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - AI articles, vector search, third-party search, comments, or multi-language
    article translation
