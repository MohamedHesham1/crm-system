# responsive — plan overview

Entry point for the **responsive** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 12 | [`12-story-mobile-responsive-agent-sidebar-and-layout-touch-ups.md`](12-story-mobile-responsive-agent-sidebar-and-layout-touch-ups.md) | Mobile-responsive agent sidebar and layout touch-ups | — | Stories 01, 09, 10 |

## Dependency notes

- **Story 12** restructures the `<aside>` created by story 01 ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)) into a client drawer component. It consumes — and must not extend — the token system, type scale and `Wordmark` / `ThemeToggle` components introduced by story 10 ([`../design/10-story-dark-light-mode-branding-and-a-visual-design-pass.md`](../design/10-story-dark-light-mode-branding-and-a-visual-design-pass.md)).
- Runs **after** story 09 ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md)), whose suite is the regression baseline: no pre-existing test file is edited, and `npm test` must stay green.
- Layout and CSS only, plus one piece of local `useState` for the drawer. No backend, route, or data-fetching change; nothing under `app/api/**` or `prisma/**` is in scope.
