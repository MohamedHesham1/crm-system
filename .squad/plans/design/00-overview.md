# design — plan overview

Entry point for the **design** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [`10-story-dark-light-mode-branding-and-a-visual-design-pass.md`](10-story-dark-light-mode-branding-and-a-visual-design-pass.md) | Dark/light mode, branding, and a visual design pass | — | Stories 01–09 |

## Dependency notes

- **This feature runs last.** Story 10 is a presentation-layer pass over pages built by Stories 01–08, so every one of those pages must already exist before it starts. It changes no component logic, data fetching, route, or response shape.
- **Story 01** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)) owns the four files Story 10 rewrites most heavily: `app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, and the three route-group layouts. The design tokens **extend** Story 01's CSS variables — the shadcn variable names are kept and only their values change.
- **Story 09** ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md)) is the hard boundary. `npm test` must pass unmodified afterwards; the only permitted test-directory changes are a `window.matchMedia` stub and two new component tests. `tests/components/assigned-ticket-list.test.tsx:37` constrains how the SLA badge may be re-styled.
- **One new dependency for the whole feature**: `next-themes@0.4.6`.
