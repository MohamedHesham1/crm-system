# Story 27 — Multi-department and multi-branch support

## Prerequisites

- Stories 05–09, 20, and 21 completed.
- This is a cross-cutting data-scope migration; audit every query path before enabling multiple organizations.

---

## Story Goal

Add departments, branches, staff membership, and ticket scope. Backfill current
records into one default department/branch, preserving current access until
admins configure additional scopes.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — `User`, `Customer`, `Ticket`, `Comment`, `AuditLog`, and `Notification` relations define migration and scope changes.
2. `lib/ticket-access.ts` — `ticketScopeWhere()` centralizes existing ticket access; extend scope here without weakening customer ownership.
3. `app/api/tickets/route.ts` — ticket list/create paths are wrapped in viewer auth at lines 17 and 55; scope list and assignment in one change.
4. `app/api/dashboard/route.ts` — dashboard `GET` starts at line 16; apply branch filters to all summary counts and ticket reads.
5. `app/api/reports/route.ts` — report `GET` starts at line 31; report and CSAT aggregates must use same scope.
6. `app/api/admin/audit/route.ts` — audit API is admin-only; preserve global audit access for authorized administrators.
7. `lib/activity.ts` — notifications and audit writers must keep organization identity when ticket ownership changes.

---

## Implementation tasks

### 1 — Add organization models and backfill

**Files: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`**

- Add Department and Branch, membership relations, and nullable ticket/customer scope references.
- Migration creates one default department and branch, backfills existing rows, then enforces required scope where safe.
- Seed is idempotent and does not reset admin-managed names.

### 2 — Add admin organization management

**Create files under `app/api/admin/departments/`, `app/api/admin/branches/`, `app/agent/admin/organization/`; add typed client/forms**

- Use `withAuth({ role: "admin" })` and permission checks.
- Assign staff to one or more departments and a branch; define archival behavior for scopes in use.

### 3 — Centralize and apply scope

**Files: `lib/ticket-access.ts`, ticket/customer APIs, dashboard, reports, search, notification and audit reads**

- Add membership scope to every list/detail/aggregate. Enforce target department access on assignment and ticket creation.
- Admin retains organization-wide view. Customer access stays constrained by linked customer profile.
- Ensure audit remains globally visible to admin; agent sees only authorized scoped ticket history.

### 4 — Test cross-scope access

**Create `tests/api/organizations.test.ts`; update tests for tickets, dashboard, reports, notifications**

- Test cross-department/branch deny, membership allow, admin override, customer ownership, and default backfill.

---

## Edge Cases & Failure Modes

- Existing rows are backfilled before non-null constraint; migration is transactional where SQLite permits.
- Deactivated department/branch cannot receive new tickets but remains readable historically.
- User assigned to multiple departments sees only permitted tickets; never infer scope from client-supplied branch id.
- Aggregates cannot leak counts from another scope.

---

## Test Plan

1. API tests under `tests/api/organizations.test.ts` cover backfill and auth matrix.
2. Update ticket/dashboard/report/notification tests for scope.
3. Run full `npm test`, Prisma migration check, and build.

---

## Migration / Rollback

- Back up DB before creating/backfilling required organization ids. Deploy additive fields/backfill first, then code enforcement.
- Rollback code before constraints; retain default records/columns until all scoped data is migrated or backup restored.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and build.
2. **Tests pass:** `npm test`.
3. **Regression:** create two departments, verify agent cannot read other department ticket through UI or direct API, verify admin can.

---

## Done Criteria

- [ ] Existing data backfilled to default department/branch.
- [ ] Admin manages org units and staff membership.
- [ ] Ticket, dashboard, report, search, audit, and notification paths respect scope.
- [ ] Customer ownership and admin-wide access remain correct.
