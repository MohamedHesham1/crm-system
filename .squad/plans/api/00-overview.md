# api — plan overview

Entry point for the **api** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 23 | [`23-story-public-api-keys-and-webhooks.md`](23-story-public-api-keys-and-webhooks.md) | Public API keys and webhooks | — | Stories 06, 09, 21 |

## Dependency notes

- Separate versioned integration API from browser session routes; API keys
  are revocable and scoped.
