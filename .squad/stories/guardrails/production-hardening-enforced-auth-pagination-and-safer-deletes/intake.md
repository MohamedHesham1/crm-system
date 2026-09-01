# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/guardrails/production-hardening-enforced-auth-pagination-and-safer-deletes/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Guardrails
- **Feature slug (folder under `plans/`):** `guardrails`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Production hardening: enforced auth, pagination, and safer deletes
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Four gaps identified in a post-implementation codebase review, none of them
new features: auth checks that depend on every route remembering to call
them rather than being structurally enforced, ticket/customer list
endpoints with no pagination, a hard-delete on tickets that leaves the audit trail pointing at a
dangling row, and no throttle on the two public unauthenticated endpoints.
Fixes existing behavior; adds no new user-facing feature.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- `withAuth(handler, { role })` helper added to `lib/api/http.ts`, wrapping
  a route handler so it cannot be exported without declaring a role
  requirement — a route handler omitting it is a compile error, not a
  silent gap. Existing `requireAgent()`/`requireAdmin()`/`requireUser()`
  keep their current signatures and become the implementation this wrapper
  calls internally; no route's authorization behavior changes, only how
  it's declared. Every existing route under `app/api/**` migrated to the
  wrapper as part of this story — a stray direct call to the old helpers
  outside `lib/api/http.ts` itself should be a grep miss by the end
- `GET /api/tickets` and `GET /api/customers` accept `page` and `pageSize`
  query params (`pageSize` default 25, max 100), applied via Prisma
  `take`/`skip`; response shape adds `{ total, page, pageSize }` alongside
  the existing array. Existing callers (`TicketTable`, customer list page)
  updated to paginate rather than fetch everything
- `POST /api/register` and the credentials `authorize()` in `auth.ts` gain
  a basic per-IP attempt throttle (in-memory is fine at this scale — no
  Redis dependency introduced) — beyond a small threshold in a short
  window, respond `429` instead of attempting the DB lookup/hash compare
- `DELETE /api/tickets/[id]` changed from a hard delete to a soft delete:
  add `Ticket.deletedAt DateTime?` (nullable, indexed), the delete route
  sets it instead of removing the row, `ticketScopeWhere()` and every
  ticket list/detail query excludes soft-deleted rows by default, and the
  delete action itself gets a `logActivity()` entry — closing the gap
  where `AuditLog.entityId` could point at a row that no longer exists
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold (`lib/api/http.ts`, `auth.ts`), story 02-customers (customer list endpoint), story 03-admin (`requireAdmin()`), story 05-tickets (ticket routes, `ticketScopeWhere()`), story 08-reports (`Ticket.resolvedAt` and the finalized Ticket shape). Should run after story 09-tests so the existing suite is the regression baseline this story is checked against — every one of story 09's 20 tests must still pass unchanged, since this story touches shared auth/query code every other route depends on

## Extra notes (optional)

- Surfaced by a codebase review, not the original feature list — see chat history for the full review this story is drawn from.

## Technical hints (optional)

- `withAuth()` should be a thin wrapper, not a rewrite of `requireAgent()`/`requireAdmin()`/`requireUser()` — those three keep working as-is and get called from inside it, so this is additive, not a rip-and-replace of auth logic that already works. Pagination: keep it offset-based (`page`/`pageSize`), not cursor-based — matches the existing `findMany` calls with the least structural change. The rate limiter only needs to survive a single-process deployment; do not add Redis or another infra dependency for an 11th story on a project this size. Prisma is pinned to 6.19.3 — the `Ticket.deletedAt` addition is a plain nullable column + index, same shape as `resolvedAt` in story 08. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Server-side prefetch/hydration for the dashboard and ticket-list pages (removing the loading-spinner-on-navigation gap) — a real improvement, but a frontend-rendering change, not a hardening/correctness fix, so it's better scoped as its own story if picked up
  - A distributed rate limiter (Redis-backed), soft delete for any model other than `Ticket`, a full permission system beyond the existing three roles, WebSocket/real-time infrastructure (live chat is still a documented cut from the original feature list, not reopened here)
