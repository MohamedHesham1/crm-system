# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Design
- **Feature slug (folder under `plans/`):** `design`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Dark/light mode, branding, and a visual design pass
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Two things, both presentation-layer only: a user-toggleable light/dark
theme using next-themes, and a genuine visual design pass across every
existing page — a real typography and color system, consistent spacing
and hierarchy, and light custom branding. This story does not add or
change any component logic, data fetching, route, or behavior that
story 09's tests cover. If a visual change seems to require restructuring
a component's markup, prefer the smallest change that achieves the look,
and confirm story 09's tests still pass afterward.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- next-themes installed and wired via a ThemeProvider in app/providers.tsx,
  alongside the existing SessionProvider and QueryClientProvider
- Theme toggle control in both the agent sidebar and the portal top nav
- Toggling switches instantly, no page reload, no flash of the wrong
  theme on initial load
- Defaults to system preference on first visit; persists across sessions

- A defined design token system, extending (not replacing) the CSS
  variables story 01 already set up in app/globals.css:
  - A small named color palette beyond shadcn's stock defaults — a
    primary, an accent, and neutral tones — expressed as CSS variables,
    not scattered inline hex values
  - A heading/display typeface paired with a body typeface (via
    next/font/google or a similar font-loading approach), limited to
    1-2 font families total for load performance
  - A consistent type scale: a small, named set of sizes/weights used
    everywhere headings, body text, and muted/meta text appear, rather
    than ad hoc Tailwind classes chosen page by page

- Ground the direction in the actual subject: this is an internal B2B
  support tool used daily by staff and customers — professional and
  trustworthy in tone, not flashy, not generic. Explicitly avoid these
  three overused AI-generated-design defaults: (1) a cream/off-white
  background with a high-contrast serif display face and a terracotta
  accent, (2) a near-black background with a single bright neon or
  vermilion accent, (3) a broadsheet-style layout with hairline rules
  and zero border-radius. Pick a direction that feels specific to a
  ticketing/support tool, not a template default

- The token system and type scale applied consistently across every
  existing page — list each one explicitly so none get missed:
  - `(auth)`: login, register
  - Agent area: dashboard, tickets list, ticket detail, customers list,
    customer detail, admin users list, admin create-account form, audit
    trail, reports
  - Portal: tickets list, ticket detail, new-ticket form, FAQ

- A consistent spacing and visual-hierarchy pass across those same
  pages: clear, consistent distinction between headings, body text,
  and muted/meta text; consistent card and table styling across every
  list and detail page rather than each one looking independently
  styled

- One tasteful, restrained "signature" detail that gives the app a
  recognizable identity — for example, a distinctive treatment of the
  SLA-breach indicator or the sidebar, not a decorative flourish added
  for its own sake. Spend boldness in exactly one place; keep everything
  else disciplined and quiet

- A company name/wordmark (placeholder branding is fine, does not need
  to be a real designed logo) replacing the generic "CRM" text in both
  the sidebar and top nav, folded into the same token system rather
  than bolted on separately
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold — app/providers.tsx, app/globals.css theme tokens, sidebar-nav.tsx, and top-nav.tsx must already exist. Practically depends on stories 02–09 having been executed too, since the design pass is only complete once every page it lists actually exists.

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Use next-themes with attribute="class" — matches how shadcn/ui's Tailwind v4 theme variables are structured in this project (.dark class selector in app/globals.css, not a data attribute). Extend the existing CSS variable tokens from story 01 rather than replacing them outright, so the dark/light toggle and the new design tokens are the same system, not two overlapping ones. Keep new fonts to 1-2 families, loaded once, to avoid a performance regression. Do not restructure component markup or data-fetching to achieve a visual change — this is a styling pass, not a refactor. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Any change to component logic, data fetching, routes, or behavior story 09's tests cover; full custom illustration or graphic assets; marketing-style animation; per-tenant/multi-brand theming; pixel-precise handling of unusual screen sizes (basic responsiveness only — full mobile-specific design is already tracked elsewhere as partial coverage); a real professionally designed logo asset; theme customization beyond light/dark; per-user theme preference stored in the database (client-side preference only)
