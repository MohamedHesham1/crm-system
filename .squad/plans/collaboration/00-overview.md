# collaboration — plan overview

Entry point for the **collaboration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [`13-story-internal-notes-and-quick-replies.md`](13-story-internal-notes-and-quick-replies.md) | Internal notes and quick replies | — | Stories 05, 06, 09 |
| 18 | [`18-story-team-mentions-and-collaboration.md`](18-story-team-mentions-and-collaboration.md) | Team mentions and collaboration | — | Stories 06, 09, 13 |

## Dependency notes

- Story 13 extends Story 05's scoped comment API and shared agent/portal
  conversation UI. Customer visibility is enforced by the API, not only by
  hiding internal-note controls in the portal.
- Story 13 follows Story 09's Vitest API and component test conventions. It
  adds an additive SQLite migration; existing comments remain public.
