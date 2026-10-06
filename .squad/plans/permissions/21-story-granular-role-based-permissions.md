# Story 21 — Granular role-based permissions

## Prerequisites

- Stories 03, 06, and 09 completed.
- Preserve fixed-role access until a user has explicit permission records and defaults have been safely seeded.

---

## Story Goal

Add typed staff capabilities and admin-managed grants while preserving current
ADMIN/AGENT behavior through a default permission matrix. Keep CUSTOMER
separate from staff authorization.

---

## Context — Read These Files First

1. `lib/roles.ts` — `Role` and `isStaff()` define current role hierarchy; preserve its role semantics.
2. `lib/api/http.ts` — `AuthRole`, `withAuth()`, and `requireAdmin()` establish route guards; permission checks supplement, not bypass, wrappers.
3. `app/agent/admin/layout.tsx` — `AdminLayout()` starts at line 6; permission-specific pages stay behind current ADMIN gate initially.
4. `app/api/admin/audit/route.ts` — admin audit reads use explicit wrapper; use `logActivity()` for permission changes.
5. `tests/api/guardrails.test.ts` — existing API security regression conventions.

---

## Implementation tasks

### 1 — Define permission catalog and defaults

**Files: `lib/permissions.ts`, `lib/validation/permissions.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`**

- Create closed permission tuple and type; add `hasPermission(viewer, permission)` with explicit default mapping.
- Persist per-user grants/revocations with uniqueness and actor metadata.
- Seed current behavior: ADMIN all staff capabilities; AGENT existing agent capabilities; CUSTOMER none.

### 2 — Add admin grant management

**Create files: `app/api/admin/users/[id]/permissions/route.ts`, `components/agent/admin/permission-editor.tsx`, `tests/api/permissions.test.ts`**

- Require admin wrapper and prohibit self-grant and ADMIN privilege mutation.
- Log each change transactionally to existing audit trail.

### 3 — Migrate selected routes incrementally

**Files: ticket/customer/task/article/settings/API route handlers as applicable**

- Replace only checks directly represented by permission catalog. Preserve viewer ownership and special assignment invariants.
- Unmigrated routes retain current role behavior; unknown permission denies.

### 4 — Test compatibility and denial

**Create file: `tests/components/permission-editor.test.tsx`**

- Test seeded defaults, grants/revocations, self-grant rejection, and route denial.

---

## Edge Cases & Failure Modes

- Missing grant row uses documented seeded default, not blanket allow.
- Malformed/unknown permission always denies.
- Admin cannot remove own last-admin access or grant new admin privilege.
- Permission change and audit row commit atomically.

---

## Test Plan

1. API tests for default matrix, grant/revoke, non-admin denial, and audit.
2. Component tests for permission editor and error display.
3. Run `npm test` and `npm run build`.

---

## Migration / Rollback

- Seed defaults before replacing route checks; make grants additive.
- Roll back code before removing tables; preserve permission audit entries.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and build.
2. **Tests pass:** `npm test`.
3. **Regression:** existing ADMIN and AGENT flows retain access; explicit denied capability fails closed.

---

## Done Criteria

- [ ] Typed permission catalog and centralized checker exist.
- [ ] Default matrix preserves existing behavior.
- [ ] Admin grants are audited and self-grant/escalation blocked.
- [ ] Migrated routes enforce capabilities; tests pass.
