# Story 15 — Customer interaction history and ticket timeline

## Prerequisites

- Stories 02, 05, and 06 completed for customer, ticket/comment, and audit models.
- Story 13 completed: [`../collaboration/13-story-internal-notes-and-quick-replies.md`](../collaboration/13-story-internal-notes-and-quick-replies.md) defines private-note visibility.
- Story 09 completed for API and component regression tests.

---

## Story Goal

Show staff customer ticket history and a per-ticket event timeline using
existing tickets, comments, internal notes, and audit entries. Do not duplicate
events into a new activity store.

---

## Context — Read These Files First

1. `components/agent/customers/customer-profile.tsx` — `CustomerProfile()` starts at line 13; add the staff history section alongside contact and notes.
2. `app/api/customers/[id]/route.ts` — guarded `GET` starts at line 7 and currently returns the customer at line 17; preserve staff authorization while adding a separately scoped history response.
3. `app/api/tickets/[id]/comments/route.ts` — `COMMENT_SELECT` starts at line 7, `GET` at line 25, and `POST` at line 42; Story 13 adds visibility that timeline reads must honor.
4. `app/api/admin/audit/route.ts` — admin audit reads use `withAuth` at line 7; reuse current `AuditLog` detail instead of copying its records.
5. `prisma/schema.prisma` — `Ticket`, `Comment`, and `AuditLog` are declared at lines 59, 139, and 157; use existing relationships and soft-delete semantics.
6. `tests/api/activity.test.ts` — API integration test pattern verifies audit writes against the real test DB.

---

## Implementation tasks

### 1 — Add staff-scoped history reads

**Files: `app/api/customers/[id]/route.ts`, `app/api/tickets/[id]/timeline/route.ts`, `lib/customers.ts`, `lib/tickets.ts`**

- Add a customer ticket-history response scoped by `customerId` and `deletedAt: null`, ordered newest first, with subject/status/priority/date/assignee.
- Add `GET /api/tickets/[id]/timeline`, wrapped in `withAuth({ role: "agent" })`; return ticket creation, comments, and audit rows for that ticket in chronological order.
- Include only necessary fields. Audit rows use immutable `detail`; comments include author and `isInternal`.
- Never add timeline to customer portal APIs. Keep existing comments `GET` filtering from Story 13.

### 2 — Render history and timeline

**Files: `components/agent/customers/customer-profile.tsx`, `components/agent/tickets/ticket-detail.tsx`**

- Add loading, empty, error, and populated states using existing UI patterns.
- Render private notes with an explicit internal label. Sort merged timeline events by timestamp with deterministic tie ordering.
- Do not render dangling audit references as links.

### 3 — Test scope and visibility

**Create files: `tests/api/customer-history.test.ts`, `tests/api/ticket-timeline.test.ts`, `tests/components/customer-history.test.tsx`, `tests/components/ticket-timeline.test.tsx`**

- Verify soft deletes, customer ownership, private-note visibility, and timeline ordering.
- Use existing database factories and `renderWithQuery()` helpers.

---

## Edge Cases & Failure Modes

- Missing customer/ticket returns existing `404` shape; cross-customer or deleted ticket events are not returned.
- Private notes are staff-only even if a portal caller guesses the route; do not mount this endpoint in portal pages.
- Equal timestamps sort deterministically by event type/id.
- Dangling audit `entityId` is treated as history text, never as an assumed live ticket.

---

## Test Plan

1. API integration: add customer history/timeline tests under `tests/api/`; follow `tests/api/activity.test.ts`.
2. Components: test loading/error/empty states and internal-note labels under `tests/components/`.
3. Regression: run `npm test`.

---

## Verification Steps

1. **Backend builds:** run `npx prisma validate` and `npx prisma generate` from repository root; no schema migration expected.
2. **Tests pass:** run `npm test`.
3. **Regression:** verify customer profile and ticket detail load, and customer portal never receives internal notes.

---

## Done Criteria

- [ ] Staff customer view lists non-deleted tickets and relevant customer interactions.
- [ ] Ticket detail displays creation, comments, internal notes, and audit events chronologically.
- [ ] Every new endpoint uses `withAuth` and scopes by requested entity.
- [ ] Portal payloads do not expose private notes or staff-only audit details.
- [ ] Tests pass and customer overview is updated.
