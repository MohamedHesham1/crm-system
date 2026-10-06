# attachments — plan overview

Entry point for the **attachments** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 16 | [`16-story-local-ticket-attachments.md`](16-story-local-ticket-attachments.md) | Local ticket attachments | — | Stories 02, 05, 09 |

## Dependency notes

- Stores file bytes on a configured durable local volume; ephemeral
  serverless filesystems are unsupported.
- Reuses customer/ticket ownership checks; attachment metadata migration is
  independent of Stories 13 and 14.
