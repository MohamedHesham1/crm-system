# Story 18 — Team mentions and collaboration

## Prerequisites

- Story 06 completed for notifications.
- Story 13 completed: [`13-story-internal-notes-and-quick-replies.md`](13-story-internal-notes-and-quick-replies.md) provides private notes.
- Story 09 completed for tests.

---

## Story Goal

Let staff explicitly mention other staff on ticket comments and internal
notes. Notify each mentioned staff member once; customers cannot mention staff
or receive staff-only metadata.

---

## Context — Read These Files First

1. `components/agent/tickets/comment-thread.tsx` — `CommentThread()` starts at line 17; extend staff composer while preserving shared portal rendering.
2. `app/api/tickets/[id]/comments/route.ts` — `POST` starts at line 42 and creates comment plus notification in one transaction; validate mention ids before writes.
3. `lib/activity.ts` — `notify()` starts at line 25 and suppresses actor notifications; reuse it for mention deliveries.
4. `lib/validation/notification.ts` — `NOTIFICATION_TYPES` starts at line 21; add mention type here as sole type source.

---

## Implementation tasks

### 1 — Persist validated comment mentions

**Files: `prisma/schema.prisma`, `lib/validation/ticket.ts`, `app/api/tickets/[id]/comments/route.ts`**

- Add normalized `CommentMention` join model with unique `(commentId, userId)` and cascading comment relation.
- Add optional `mentionedUserIds`. Customer request with mentions or internal flag returns `403`.
- In existing transaction, verify recipients have staff roles, create deduplicated rows, and write notifications through `notify()`.

### 2 — Add picker and rendering

**Files: `components/agent/tickets/comment-thread.tsx`, `lib/tickets.ts`**

- Add staff-only search/select using existing staff-user endpoint and show mention attribution in staff thread.
- Customer response omits mention metadata; do not render staff names or controls in portal.

### 3 — Add focused tests

**Create files: `tests/api/comment-mentions.test.ts`, `tests/components/comment-mentions.test.tsx`**

- Verify invalid recipients reject whole write, duplicates collapse, author is excluded, and portal payload omits mention metadata.

---

## Edge Cases & Failure Modes

- Non-staff or missing recipient rejects before comment creation.
- Duplicate ids create one relation and notification per target.
- Self-mention does not create self-notification.
- Notification failure rolls back comment and joins.
- Customer cannot submit mentions or private-note payloads.

---

## Test Plan

1. API integration under `tests/api/` covers validation, transaction, dedupe, and privacy.
2. Component tests under `tests/components/` cover picker visibility and selection.
3. Run `npm test`.

---

## Migration / Rollback

- Add join table and notification type. Existing comments unchanged.
- Back up before rollback; retain mention/notification history if reverting UI.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and `npm run build`.
2. **Tests pass:** `npm test`.
3. **Regression:** staff mention creates bell item; portal sees public body only.

---

## Done Criteria

- [ ] Staff can mention other AGENT/ADMIN users only; customer cannot mention.
- [ ] Mentions and notifications are unique and transactional.
- [ ] Portal response contains no staff-only mention metadata.
- [ ] API routes use `withAuth`; tests pass.
