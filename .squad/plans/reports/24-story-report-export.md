# Story 24 — Report export

## Prerequisites

- Stories 08 and 09 completed; reuse current report calculations and tests.

---

## Story Goal

Export existing ticket, SLA, agent-performance, and customer-satisfaction
reports as CSV and printable PDF using the same filters and authorization as
the on-screen reports.

---

## Context — Read These Files First

1. `app/api/reports/route.ts` — `GET` starts at line 31 and computes ticket, SLA, and CSAT aggregates; share calculations with export.
2. `app/api/reports/agents/route.ts` — admin-only agent performance report route; preserve its role restriction.
3. `components/agent/reports/reports-overview.tsx` — existing report page and filters.
4. `tests/api/activity.test.ts` — API test setup and auth mocking; follow project integration conventions.

---

## Implementation tasks

### 1 — Extract reusable report data queries

**Files: `app/api/reports/route.ts`, `app/api/reports/agents/route.ts`, `lib/report-metrics.ts`**

- Extract query/aggregation functions that serve both JSON and downloads.
- Keep validation, date bounds, roles, soft delete filters, and branch scope ready for Story 27.

### 2 — Add CSV and PDF response routes

**Create files under `app/api/reports/export/`**

- Add explicit format route or format query with validated `csv|pdf`.
- CSV-escape cells and prefix formula-leading values (`=`, `+`, `-`, `@`) safely; sanitize filename.
- Generate bounded printable PDF from already-authorized report DTO; set attachment headers and content type.

### 3 — Add export controls

**Files: `components/agent/reports/reports-overview.tsx`, report components**

- Export using current selected filters/date range. Show loading and failure states; do not silently download stale data.

### 4 — Test parity and safe output

**Create files: `tests/api/report-export.test.ts`, `tests/components/report-export.test.tsx`**

- Compare exported totals to report API for same filters; test formula escaping, no-data, invalid range, and role scope.

---

## Edge Cases & Failure Modes

- Large date range is rejected or bounded; no unbounded memory generation.
- CSV formulas cannot execute when opened in spreadsheet.
- PDF generation failure returns explicit error, not empty successful file.
- Customer caller never receives management report.

---

## Test Plan

1. API tests under `tests/api/` for parity, auth, headers, and CSV injection.
2. Component tests under `tests/components/` for export controls.
3. Run `npm test`, lint, and build.

---

## Verification Steps

1. **Backend builds:** run `npm run build`.
2. **Tests pass:** run `npm test`.
3. **Regression:** export same date filter in CSV/PDF; verify totals match on-screen result.

---

## Done Criteria

- [ ] Existing reports export as CSV and PDF.
- [ ] Filters and permissions match on-screen reporting.
- [ ] CSV injection and output size guarded.
- [ ] Tests pass.
