# automation — plan overview

Entry point for the **automation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 28 | [`28-story-self-hosted-background-scheduler.md`](28-story-self-hosted-background-scheduler.md) | Self-hosted background scheduler | — | Stories 06, 14, 17, 20, 21 |

## Dependency notes

- Worker is a separate process, never started per Next.js web instance.
  Existing secured cron endpoint remains available.
