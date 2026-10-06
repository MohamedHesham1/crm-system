# Story 17 — Agent tasks and reminders

## Prerequisites

- Stories 02, 06, 07, and 09 completed for customers, notifications, dashboard, and tests.
- Story 28 adds scheduled reminder dispatch; this story creates task records and UI but does not start a scheduler.

---

## Story Goal

Give staff a persistent follow-up task list with due dates and optional
ticket/customer links. Show due and overdue state; Story 28 sends reminder
notifications.

---

## Context — Read These Files First

1. `components/agent/dashboard/dashboard-overview.tsx` — `DashboardOverview()` starts at line 10; add task summary without changing ticket query behavior.
2. `app/api/notifications/route.ts` — user-scoped `GET` is wrapped with `withAuth` at line 7; worker reminders reuse this feed.
3. `lib/notifications.ts` — `notificationKeys` starts at line 22; invalidate after relevant reminder changes.
4. `lib/api/http.ts` — `withAuth()` starts at line 99; task routes declare staff role.
5. `tests/helpers/factories.ts` — existing factories create staff, customers, and tickets for task API fixtures.

---

## Implementation tasks

### 1 — Add task model and validation

**Files: `prisma/schema.prisma`, `lib/validation/task.ts`, `prisma/migrations/`**

- Add task model with owner, title, optional description/dueAt, optional ticket/customer relations, completion timestamp, and audit timestamps.
- Validate create/update/completion input; index owner/completion/due date.

### 2 — Add scoped task APIs and client

**Create files: `app/api/tasks/route.ts`, `app/api/tasks/[id]/route.ts`, `lib/tasks.ts`**

- Use `withAuth({ role: "agent" })`; owner manages own task, admin may manage any staff task.
- Scope linked ids with current ticket/customer access helpers; reject missing/deleted linked entities.
- Return bounded upcoming, overdue, and completed lists; never return another agent's tasks.

### 3 — Add pages and dashboard card

**Create files: `app/agent/tasks/page.tsx`, `components/agent/tasks/task-list.tsx`, `components/agent/tasks/task-form.tsx`; edit `components/agent/dashboard/dashboard-overview.tsx`**

- Add create/edit/complete/delete UI and links to ticket/customer.
- Show upcoming/overdue tasks on dashboard. Reminder delivery is deferred to Story 28.

### 4 — Test lifecycle and ownership

**Create files: `tests/api/tasks.test.ts`, `tests/components/tasks.test.tsx`**

- Test role/ownership scope, links, due validation, completion, and overdue display.

---

## Edge Cases & Failure Modes

- Completed tasks never qualify for reminders.
- Invalid linked id returns validation/not-found without persisting task.
- Non-admin cannot read or mutate another staff member's task.
- Missing due date creates non-reminder-eligible task.

---

## Test Plan

1. API tests under `tests/api/` cover CRUD, scope, completion, and due date.
2. Component tests under `tests/components/` cover task form/list states.
3. Run `npm test`; worker reminder tests belong to Story 28.

---

## Migration / Rollback

- Add task table and indexes. Restore backup to roll back; preserve task data if application rollback is required.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and `npm run build`.
2. **Tests pass:** `npm test`.
3. **Regression:** create overdue task, confirm dashboard state, complete it, and confirm it no longer appears overdue.

---

## Done Criteria

- [ ] Staff manage own tasks; admins manage staff tasks.
- [ ] Ticket/customer links and tasks are correctly scoped.
- [ ] Dashboard shows due/overdue tasks and completion history persists.
- [ ] Reminder data is ready for Story 28; tests pass.
