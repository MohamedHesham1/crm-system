# Story 20 — Configurable system settings

## Prerequisites

- Stories 03, 05, 09 completed.
- Story 14 may be implemented first; keep existing SLA calculations compatible while making targets configurable.

---

## Story Goal

Let admins manage ticket categories and per-priority response/resolution
targets. Seed defaults matching existing behavior; changing settings must not
silently rewrite deadlines on existing tickets.

---

## Context — Read These Files First

1. `lib/sla.ts` — `SLA_HOURS` starts at line 16 and `defaultDueAt()` at line 22; preserve current default targets and isolate resolution/response target semantics.
2. `lib/validation/ticket.ts` — `createTicketSchema` starts at line 27 and category validation at line 24; replace hardcoded category contract with shared setting lookup without weakening validation.
3. `app/api/admin/users/route.ts` — admin `GET` starts at line 8; use same role guard for settings routes.
4. `prisma/seed.ts` — seed existing defaults idempotently; never overwrite admin-edited values on later seed.
5. `tests/api/tickets.test.ts` — create endpoint tests capture current ticket behavior.

---

## Implementation tasks

### 1 — Persist settings and seed defaults

**Files: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`**

- Add category model with unique normalized name, active flag, and ordering.
- Add per-priority response/resolution target settings with bounded positive hours.
- Seed categories/targets to match current production constants using upsert that does not overwrite edits.

### 2 — Add admin settings API and UI

**Create files: `app/api/admin/settings/route.ts`, `app/agent/admin/settings/page.tsx`, `components/agent/admin/settings-form.tsx`, `lib/settings.ts`, `lib/validation/settings.ts`**

- Use `withAuth({ role: "admin" })`; validate every write and audit edits.
- Support category add/rename/deactivate/order and SLA target update.
- Deactivated categories remain valid historical ticket text but cannot be selected for new tickets.

### 3 — Wire tickets and reports to settings

**Files: `app/api/tickets/route.ts`, `lib/sla.ts`, category forms, SLA report queries**

- Read settings once per creation/evaluation operation; avoid per-row settings queries.
- Set `dueAt` using current priority targets at creation; existing `dueAt` remains unchanged.
- Document exact response-target measurement semantics; do not claim a response SLA until a persisted first-response timestamp exists.

### 4 — Test defaults and changes

**Create files under `tests/api/` and `tests/components/`**

- Verify seed idempotency, category lifecycle, admin-only access, target bounds, new ticket defaults, and unchanged existing ticket deadlines.

---

## Edge Cases & Failure Modes

- Empty settings DB loads seeded defaults; never return an empty category list that blocks ticket creation.
- Concurrent category rename collision returns explicit conflict.
- Invalid/zero/unbounded SLA hours are rejected.
- Settings update does not mutate existing `dueAt` or historical category text.

---

## Test Plan

1. API integration for settings and ticket creation defaults.
2. Component tests for category and target forms.
3. Run `npm test`, seed idempotency check, and report regression tests.

---

## Migration / Rollback

- Add settings tables and seed defaults. Preserve edits in backup before rollback.
- Backfill defaults before switching ticket creation from constants.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and `npm run build`.
2. **Tests pass:** `npm test`.
3. **Regression:** alter target, create ticket and verify calculated deadline; existing ticket deadline remains unchanged.

---

## Done Criteria

- [ ] Categories and SLA targets editable by admins only.
- [ ] Defaults match current behavior and seed is non-destructive.
- [ ] Existing tickets retain deadlines and category text.
- [ ] Ticket/report tests and full suite pass.
