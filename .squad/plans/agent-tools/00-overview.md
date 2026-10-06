# agent-tools — plan overview

Entry point for the **agent-tools** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 17 | [`17-story-agent-tasks-and-reminders.md`](17-story-agent-tasks-and-reminders.md) | Agent tasks and reminders | — | Stories 02, 06, 07, 09 |

## Dependency notes

- Story 17 owns task data, CRUD, and UI. Story 28 owns scheduled in-app
  reminder dispatch to avoid coupling request handlers to a worker process.
