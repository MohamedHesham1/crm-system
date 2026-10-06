# Story 28 — Self-hosted background scheduler

## Prerequisites

- Stories 06, 14, 17, 20, and 21 completed for notifications, SLA alerts, tasks, configuration, and permissions.
- Worker runs as separate process; never start it from a Next.js route/layout or every web server instance.

---

## Story Goal

Ship an optional self-hosted worker for automatic assignment, SLA alerts, task
reminders, and admin-configured escalation rules. Share domain logic with
secured HTTP endpoints while using durable DB coordination for retries.

---

## Context — Read These Files First

1. `app/api/tickets/assign-sweep/route.ts` — admin-triggered assignment sweep is the current manual operation; extract domain logic without bypassing auth on HTTP route.
2. Story 14 plan: [`../escalation/14-story-ticket-escalation-status-and-sla-breach-alerts.md`](../escalation/14-story-ticket-escalation-status-and-sla-breach-alerts.md) defines secured SLA alert endpoint and idempotency.
3. Story 17 plan: [`../agent-tools/17-story-agent-tasks-and-reminders.md`](../agent-tools/17-story-agent-tasks-and-reminders.md) defines task due/reminder data.
4. `lib/activity.ts` — transactional audit and notification writers must be reused by scheduled mutations.
5. `prisma/schema.prisma` — SQLite DB is current persistence; implement leases/unique job runs with its concurrency limits.
6. `package.json` — add separate worker command without changing Next web startup.

---

## Implementation tasks

### 1 — Extract shared job services

**Files: `lib/assignment-sweep.ts`, `lib/sla-alerts.ts`, `lib/task-reminders.ts`, `lib/escalation-rules.ts`**

- Move domain job logic from routes into injectable functions; keep HTTP wrappers and their auth unchanged.
- Define bounded batch size and explicit job result/error types.

### 2 — Add durable job lease and audit state

**Files: `prisma/schema.prisma`, `lib/worker/lease.ts`, `prisma/migrations/`**

- Add job lock/lease with owner id, expiry, heartbeat, and unique job key.
- Use atomic acquisition/renewal and idempotency constraints; release lease on graceful shutdown.

### 3 — Add separate worker process and configuration

**Create files: `worker.ts`, `lib/worker/runner.ts`, `lib/worker/config.ts`; update `package.json`, `.env.example`, `README.md`**

- Configure supported job intervals, batch limits, and shutdown timeout with bounded validation.
- Worker invokes shared functions directly, not unauthenticated HTTP calls.
- Add SIGTERM/SIGINT graceful stop and structured logs with counts/errors only; do not log secrets or message body.
- Document single/multi-instance behavior, SQLite single-writer limits, process monitor, and health/status procedure.

### 4 — Add escalation rules and delivery

**Files: `prisma/schema.prisma`, `lib/validation/settings.ts`, `lib/escalation-rules.ts`, admin settings UI**

- Add bounded rule mapping (priority/status/elapsed time to escalation action); no arbitrary executable expressions.
- Dispatch via worker with per-ticket/rule idempotency and existing audit/notification transaction patterns.

### 5 — Test worker behavior

**Create files: `tests/api/worker-jobs.test.ts`, `tests/api/worker-lease.test.ts`**

- Verify disabled jobs, bounded intervals, lease contention, expiry recovery, retry idempotency, graceful stop, and no duplicate alerts/assignments.

---

## Edge Cases & Failure Modes

- Missing DB/config causes process to fail startup explicitly; never run with permissive defaults for secrets.
- Expired lease is recoverable; active lease prevents duplicate worker execution.
- SQLite busy/transient errors use bounded retry with jitter and visible final failure.
- Graceful shutdown stops new work and waits for active transaction only up to configured timeout.
- Disabled job never runs even if stale configuration or prior worker state exists.
- Web and worker processes may run on different hosts only when DB/file storage supports shared durable access; SQLite deployment limitations documented.

---

## Test Plan

1. Unit/API tests under `tests/api/` cover job selection and idempotency.
2. Lease tests cover concurrent workers and stale lock recovery.
3. Run `npm test`, lint, build, then start worker against isolated test DB and stop cleanly.

---

## Migration / Rollback

- Add lease/job idempotency tables before enabling worker. Existing HTTP endpoints remain supported.
- On rollback disable worker first, wait for active lease expiry/release, then revert code; preserve idempotency history.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate, `npm test`, and `npm run build`.
2. **Worker starts:** run documented worker command with test DB; verify health/log heartbeat and graceful shutdown.
3. **Regression:** trigger each job twice; verify only one assignment/alert/reminder/escalation per dedupe key.

---

## Done Criteria

- [ ] Separate worker process runs configured jobs; Next web processes do not spawn worker.
- [ ] Automatic assignment, SLA alert, due reminders, and rules use shared domain logic.
- [ ] Durable lease and idempotency prevent duplicate work.
- [ ] Admin settings, logs, operational documentation, tests, and rollback are complete.
