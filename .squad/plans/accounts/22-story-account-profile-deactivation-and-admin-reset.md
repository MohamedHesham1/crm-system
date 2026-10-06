# Story 22 — Account profile, deactivation, and admin reset

## Prerequisites

- Stories 01, 03, 04, 06, 09, and 21 completed.
- Reuse Auth.js Credentials; do not add email delivery.

---

## Story Goal

Allow users to edit their own profile and admins to deactivate/reactivate
accounts or issue a one-time password-reset token for out-of-band delivery.

---

## Context — Read These Files First

1. `auth.ts` — Credentials authorization and session creation must reject inactive users and reflect reset/session state.
2. `app/api/admin/users/route.ts` — admin user list/create use `withAuth({ role: "admin" })` at lines 8 and 17.
3. `lib/password.ts` — reuse password hashing and comparison; never select/return password hash in UI/API.
4. `prisma/schema.prisma` — `User` begins at line 13; add active/session-version and hashed reset-token data compatibly.
5. `tests/api/register.test.ts` — use real DB and mocked auth conventions for credential lifecycle tests.

---

## Implementation tasks

### 1 — Add account lifecycle fields

**Files: `prisma/schema.prisma`, `prisma/migrations/`**

- Add active state and session-version field with backwards-compatible defaults.
- Add one-time reset-token hash/expiry state, or separate token table with unique hash and expiry.

### 2 — Add self-profile and admin lifecycle APIs

**Create files: `app/api/account/profile/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/users/[id]/reset/route.ts`**

- Self profile edits name and permitted contact data only; email changes are uniqueness-checked; never accept role.
- Admin deactivation/reactivation increments session version and prevents inactive login.
- Admin reset generates cryptographically random token, stores only hash, returns raw token once, and expires it.

### 3 — Implement reset consumption and UI

**Create files: `app/(auth)/reset-password/`, `components/account/profile-form.tsx`; update admin user detail**

- Consume reset token atomically; reject expired/replayed token; update password hash and increment session version.
- Add profile edit and admin lifecycle controls; warn admin token must be delivered out-of-band.

### 4 — Test lifecycle

**Create files: `tests/api/account.test.ts`, `tests/components/account.test.tsx`**

- Test ownership, role escalation payload, duplicate email, disabled login, expiry/replay, session invalidation.

---

## Edge Cases & Failure Modes

- Deactivated users fail credentials authorization and protected request after session-version check.
- Password reset token shown once; DB stores hash only; replay returns invalid/expired.
- Concurrent token consumption succeeds once only.
- Admin cannot deactivate final active admin; do not lock out all admins.
- Email lookup is never exposed to unauthenticated caller.

---

## Test Plan

1. API integration tests for self profile, lifecycle, auth denial, reset expiry/replay.
2. Component tests for profile and admin reset flows.
3. Run `npm test`, build, and lint.

---

## Migration / Rollback

- Default existing users active and preserve current session behavior until session-version validation is deployed.
- Back up before migration; rollback code and invalidate temporary reset tokens.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and build.
2. **Tests pass:** `npm test`.
3. **Regression:** deactivate test user and verify login/session denial; consume reset once and reject replay.

---

## Done Criteria

- [ ] Users edit only own profile fields.
- [ ] Admin deactivation preserves ticket/audit history and blocks access.
- [ ] Reset token is one-time, expiring, hashed at rest, and shown once.
- [ ] No email provider required; tests pass.
