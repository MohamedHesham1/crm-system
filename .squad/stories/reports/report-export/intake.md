# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/reports/report-export/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Report export
- **Feature slug (folder under `plans/`):** `reports`

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
Report export
```
Export existing reports as CSV and printable PDF with same filters and access
rules as on-screen report data.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Existing ticket, SLA, agent-performance, and customer-satisfaction reports
  export to CSV and PDF for selected date range and filters.
- Export data uses the same staff authorization, query filters, and
  aggregation rules as existing report endpoints.
- CSV cells are escaped against spreadsheet formula injection; filenames are
  sanitized; responses use safe download headers.
- PDF generated server-side from validated, bounded report data.
- Every export route uses `withAuth`; tests cover filters, auth, formats, CSV
  escaping, and empty result sets.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Ticket, SLA, agent-performance, and customer-satisfaction reports export to
  CSV and PDF using selected date range and filters.
- Export data uses the same staff authorization, filters, and aggregation
  rules as on-screen report endpoints.
- CSV cells are escaped against spreadsheet formula injection; filenames are
  sanitized and download headers are safe.
- PDF is generated server-side from validated, bounded report data.
- Every export route uses `withAuth`; tests cover filters, auth, formats, CSV
  escaping, and empty results.
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
- **Depends on code areas or other stories:** Stories 08 and 09. Reuse current
  report calculations; do not fork report queries.

## Extra notes (optional)

Staff-only export using current report filters.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Scheduled email, custom report builder, external BI, or new report types
