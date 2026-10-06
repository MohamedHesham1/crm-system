# Story 16 — Local ticket attachments

## Prerequisites

- Stories 02, 05, and 09 completed; reuse customer/ticket scope.
- Configure `ATTACHMENT_STORAGE_DIR` through the deployment environment and document durable-volume requirements.

---

## Story Goal

Store customer/ticket attachment bytes on durable local filesystem and
metadata in SQLite. Serve downloads only through authenticated,
ownership-scoped handlers. Ephemeral serverless disks are unsupported.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — `Customer` begins at line 30 and `Ticket` at line 59; add metadata relations without changing existing ownership constraints.
2. `app/api/tickets/[id]/route.ts` — `GET` is wrapped with `withAuth({ role: "viewer" })` at line 12; use same ticket scope for attachments.
3. `lib/ticket-access.ts` — `ticketScopeWhere()` and `NOT_DELETED` enforce ownership and soft-delete visibility.
4. `lib/api/http.ts` — `withAuth()` begins at line 99; every file route declares a role.
5. `tests/helpers/db.ts` — `resetDb()` clears dependents before tickets/users; add attachment cleanup in FK-safe order.

---

## Implementation tasks

### 1 — Add metadata and storage service

**Files: `prisma/schema.prisma`, `lib/attachments.ts`, `lib/attachment-storage.ts`, `prisma/migrations/`**

- Add metadata model with opaque storage key, owner type/id, uploader, original name, detected media type, size, and timestamps.
- Store bytes outside `public/` under `ATTACHMENT_STORAGE_DIR`; never derive disk paths from user input.
- Generate additive SQLite migration.

### 2 — Add authenticated upload/read/delete routes

**Create files: `app/api/tickets/[id]/attachments/route.ts`, `app/api/tickets/[id]/attachments/[attachmentId]/route.ts`, `app/api/customers/[id]/attachments/route.ts`, `app/api/customers/[id]/attachments/[attachmentId]/route.ts`**

- Accept multipart files up to 10 MiB. Validate extension and detected bytes against safe raster-image, PDF, and plain-text allowlist. Reject executable, script, HTML, and SVG.
- Repeat ticket/customer authorization for every operation. Download with safe content-disposition and `X-Content-Type-Options: nosniff`.
- Remove an unreferenced file if metadata transaction fails. Surface filesystem errors; do not return success-shaped fallbacks.

### 3 — Add attachment UI and tests

**Files: `components/agent/tickets/ticket-detail.tsx`, `components/portal/tickets/portal-ticket-detail.tsx`, `components/agent/customers/customer-profile.tsx`, `tests/api/attachments.test.ts`, `tests/components/attachments.test.tsx`**

- Add upload/list/download UI. Customer-profile attachments are staff-only.
- Use temporary test storage; test authorization, file validation, cleanup, and headers.

### 4 — Document storage operations

**File: `README.md`**

- Document durable-volume mount, backup/restore, filesystem permissions, and shared storage requirement across web instances.

---

## Edge Cases & Failure Modes

- Missing/unwritable storage returns explicit server error; never silently switch to public storage.
- MIME header is untrusted; validate bytes and extension.
- Unauthorized/missing owner returns scoped not-found; never reveal filesystem path.
- Crash between byte and metadata writes may leave orphan bytes; provide safe cleanup or documented orphan scan.

---

## Test Plan

1. API integration in `tests/api/attachments.test.ts`: auth, ownership, MIME/size, download, cleanup.
2. Component tests in `tests/components/attachments.test.tsx`: upload/list/error states.
3. Run `npm test`; ensure tests clean temporary files.

---

## Migration / Rollback

- Add metadata tables/indexes. Back up database and file volume together.
- On rollback, preserve files until operators export or remove them; never drop metadata while leaving untracked bytes.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and `npm run build`.
2. **Tests pass:** `npm test`.
3. **Regression:** upload/retrieve as authorized ticket participant; deny unrelated customer; delete and verify storage cleanup.

---

## Done Criteria

- [ ] Ticket and staff customer attachments use durable local storage outside public web root.
- [ ] 10 MiB cap and safe type allowlist enforced server-side.
- [ ] Every operation repeats authentication and owner scope.
- [ ] Storage operation and tests documented; suite passes.
