# escalation — plan overview

Entry point for the **escalation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 14 | [`14-story-ticket-escalation-status-and-sla-breach-alerts.md`](14-story-ticket-escalation-status-and-sla-breach-alerts.md) | Ticket escalation status and SLA breach alerts | — | Stories 05, 06, 09, 13 |

## Dependency notes

- Story 14 adds `ESCALATED` to the existing string-backed status contract and
  continues to use the shared SLA helpers; it does not add a database enum.
- SLA breach alerts are delivered to the ticket's current assignee by an
  idempotent, bearer-token-protected cron endpoint. Unassigned tickets have no
  recipient.
- Story 14 follows Story 13 because both extend the shared Prisma schema and
  ticket interaction surfaces; apply their migrations in sequence.
