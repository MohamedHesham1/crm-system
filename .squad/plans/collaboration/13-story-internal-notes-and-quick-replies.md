# Story 13 — Internal notes and quick replies

## Prerequisites

- Story 05 completed: [`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md) owns the `Comment` model, ticket-scoped comments API, and shared thread.
- Story 06 completed: [`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md) owns notification side effects attached to comments.
- Story 09 completed: [`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md) establishes the Vitest API and component suites.

---

## Story Goal

Let staff write private notes in the existing ticket conversation and choose
built-in quick replies to populate the existing composer. Keep customers on
the existing public-comment flow: internal notes must never appear in a
customer API response or be creatable by a customer, regardless of the UI.

Quick replies are fixed application-provided text in this story. Staff must
explicitly submit a draft, and selecting a quick reply must not submit it.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — `Comment` is at lines 139–155. Add a defaulted visibility field there; existing rows must remain public.
2. `app/api/tickets/[id]/comments/route.ts` — `COMMENT_SELECT` is at lines 7–12, `loadScopedTicket()` at lines 15–23, the guarded `GET` starts at line 25 and reads comments at lines 32–36, and `POST` starts at line 42 and writes inside a transaction at lines 55–59. Keep both ownership checks and the existing notification transaction.
3. `lib/validation/ticket.ts` — `createCommentSchema` starts at line 74. Extend the existing input contract; do not create a parallel comment schema.
4. `components/agent/tickets/comment-thread.tsx` — local draft state starts at line 19, polling is configured at lines 21–31, the heading is at line 51, and rendered comment bodies start at line 74. Keep the shared component and polling behavior.
5. `components/agent/tickets/ticket-detail.tsx` — the staff thread is rendered at line 225. `components/portal/tickets/portal-ticket-detail.tsx` renders the same thread at line 48. Both surfaces must continue to share one component.
6. `lib/tickets.ts` — `TicketComment` starts at line 34, `fetchComments()` at line 102, and `postComment()` at line 131; response dates are JSON ISO strings and the write helper is the single client path.
7. `tests/api/activity.test.ts` — read the existing real-SQLite API test pattern for route handlers and transactional side effects.
8. `tests/components/notification-bell.test.tsx` — follow the React Testing Library and `renderWithQuery()` pattern; place the new UI test in `tests/components/`.
9. `tests/helpers/db.ts` and `tests/helpers/factories.ts` — use `resetDb()` and the existing user/customer/ticket factories in API coverage.

---

## Product rules (from story)

- All existing comments are public after migration.
- Only staff may create internal notes. Only staff may retrieve them.
- Internal-note filtering is enforced in `GET /api/tickets/[id]/comments`; hiding them in the portal is not authorization.
- The existing ticket scope check applies before either comment query or write.
- Quick reply selection appends to the existing composer draft, adding a line break when needed; it does not discard user text, post a comment, or switch the current visibility mode.

---

## Implementation tasks

### 1 — Add an additive comment visibility column

**File: `prisma/schema.prisma`**

- Add `isInternal Boolean @default(false)` to `Comment`.
- Generate and commit a SQLite migration under `prisma/migrations/`. Existing rows must read as `false`; do not recreate or remove existing comment data.

### 2 — Extend the existing comment input contract

**File: `lib/validation/ticket.ts`**

- Add optional `isInternal` boolean input to `createCommentSchema`; absent means `false`.
- Preserve current trimmed body validation and 10,000-character limit.

### 3 — Enforce visibility and creation permissions in the API

**File: `app/api/tickets/[id]/comments/route.ts`**

- Keep both exports wrapped in `withAuth({ role: "viewer" })`.
- Include `isInternal` in `COMMENT_SELECT`.
- For `GET`, always scope by ticket id as today; add `isInternal: false` when `viewer.kind === "customer"`. Staff receive both public comments and internal notes.
- For `POST`, default omitted `isInternal` to `false`. Return `403` for a customer request with `isInternal: true`; do not silently downgrade it to a public comment.
- Persist `isInternal` with the comment in the existing transaction. Do not change `loadScopedTicket()`, ticket ownership behavior, the notification writer, or the `201` response shape beyond the new visibility field.

### 4 — Carry visibility through the client and shared thread

**Files: `lib/tickets.ts`, `components/agent/tickets/comment-thread.tsx`, `components/agent/tickets/ticket-detail.tsx`, `components/portal/tickets/portal-ticket-detail.tsx`**

- Extend the comment response/input types and `postComment()` parameter from the existing inferred validation type.
- Pass an explicit staff capability from the staff ticket detail into `CommentThread`; pass false from the portal detail. Do not rely on this prop for authorization.
- In the shared thread, let staff choose public comment or internal note, show a clear “Internal note” label on private entries, and keep the 8-second refresh interval.
- Add a Quick replies control visible to staff only, with at least three built-in, customer-appropriate reply texts. Selecting one appends its text to the draft, inserting a line break when the draft is non-empty; it never invokes `mutation.mutate()`. Leave the current public/internal choice unchanged.
- Keep the customer composer public-only and do not render internal-note entries in the portal.

### 5 — Add focused regression coverage

**Create file: `tests/api/comments.test.ts`**

- Use the existing database helpers and `signInAs()` mock.
- Verify staff can create and read an internal note, a customer GET cannot see it, and a customer POST with `isInternal: true` receives `403`.
- Verify omitted `isInternal` creates a public comment and the owner-scoped behavior still rejects an unrelated customer's ticket.

**Create file: `tests/components/comment-thread.test.tsx`**

- Verify the staff UI shows the visibility control and quick-reply selection fills the draft without posting.
- Verify a customer-capability thread does not show either staff-only control and renders no internal note.
- Keep component tests in `tests/components/`; do not add test files outside the established test trees.

---

## Edge Cases & Failure Modes

- Existing Comment rows after migration: database default `false` keeps them public; verify a pre-existing comment appears in both staff and customer reads.
- Customer submits `isInternal: true` directly: return `403` before creating the row; verify the database count does not change.
- Customer requests another customer's ticket comments: preserve `loadScopedTicket()` and return its existing `404` response before querying comments.
- Missing visibility input: treat as `false` in both validation and persistence; old clients continue posting public comments.
- Quick reply is selected while a draft exists: append without discarding the draft; do not submit or change its visibility selection.
- A transaction or notification write fails: preserve the current transaction boundary so no partial comment is persisted.

---

## Test Plan

1. **API integration:** add `tests/api/comments.test.ts` for customer/staff visibility, forbidden private writes, legacy public comments, ownership scope, and transaction persistence. Follow `tests/api/activity.test.ts`.
2. **Component:** add `tests/components/comment-thread.test.tsx` for staff-only controls, draft insertion without submission, and hiding private notes for portal capability. Follow `tests/components/notification-bell.test.tsx`.
3. **Regression:** run the complete current API and component suite with `npm test`.

---

## Migration / Rollback

- Add only the `Comment.isInternal` column with a database default of `false`; no existing row should be rewritten as private.
- Run the migration before deploying handlers that read or write `isInternal`. If migration application fails, stop deployment and restore the database backup before retrying; do not deploy against a partially migrated schema.
- Rollback by reverting the application change and restoring the pre-migration database backup. Dropping the column would discard any internal notes written after deployment.

---

## Verification Steps

1. **Backend builds:** from the repository root, run `npx prisma validate` and `npx prisma generate`.
2. **Tests pass:** run `npm test` from the repository root; the API suite uses the isolated SQLite database configured in `vitest.config.ts`.
3. **Static checks:** run `npm run lint` and `npm run build` from the repository root.
4. **Regression:** sign in as staff and create an internal note; confirm it appears only in the staff thread. Sign in as the ticket's customer and confirm the same note is absent while public comments remain visible.
5. **Quick reply:** select a built-in reply with an existing draft; confirm the existing text is preserved, the reply is appended, and no comment is created until the staff member explicitly submits.

---

## Done Criteria

- [ ] `Comment.isInternal` is default-false and backed by an additive SQLite migration.
- [ ] Internal notes can be created and read by staff only; customer API responses exclude them and customer private-note writes return `403`.
- [ ] Staff and portal continue using the same comment thread, with server-side filtering as the privacy boundary.
- [ ] Staff quick replies populate the draft without posting or changing visibility.
- [ ] New tests live under `tests/api/` and `tests/components/`; `npm test`, lint, and build pass.
- [ ] `.squad/plans/collaboration/00-overview.md` and `.squad/plans/00-index.md` list this story.
