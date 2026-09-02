# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/responsive/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Responsive
- **Feature slug (folder under `plans/`):** `responsive`

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
Mobile-responsive agent sidebar and layout touch-ups
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
The agent sidebar is a fixed-width aside with no responsive handling,
breaking every agent page at phone width. This story turns it into a
proper mobile drawer (toggle, backdrop, slide transition, auto-close on
navigation) with zero change to existing desktop behavior, plus a small
set of companion touch-ups on the portal top nav and page padding found
during the same check. Not a visual redesign — story 10 already owns
color/typography/tokens; this is layout behavior only.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- `app/agent/layout.tsx`'s sidebar extracted into a client component
  (e.g. `components/agent/sidebar-shell.tsx`) that owns open/closed state.
  Below `md:`: sidebar is hidden by default, off-canvas via a transform
  (not `display:none`, so the slide transition has something to animate),
  revealed by a hamburger toggle button, with a semi-transparent backdrop
  behind it that closes the drawer on click. At `md:` and above: identical
  to current behavior — always visible, no toggle button rendered, no
  backdrop. Existing `Wordmark`, `SidebarNav`, sign-out button and theme
  toggle inside the aside are unchanged, only their wrapper changes
- The drawer closes automatically on navigation — clicking a nav link
  closes it before or as the new page renders, not left open over the
  destination page
- `components/portal/top-nav.tsx`: the link/email/sign-out cluster gets
  enough responsive handling (wrap, or hide the raw email text below
  `sm:`) that it neither overflows nor clips at phone width
- A handful of pages using a flat `p-8` container padding get it narrowed
  on small screens (`p-4 md:p-8` or equivalent) so content isn't flush
  against the screen edge on mobile — apply only where `p-8`/`px-8` is
  used directly on a page's outer container, not a blanket change
- Manually verified at phone width (checked via devtools mobile emulation
  is enough — no new dependency for real-device testing): dashboard cards,
  ticket detail, reports charts, and the portal pages render without
  horizontal overflow or clipped content. Where something is found
  genuinely broken during this check, fix it directly; where it already
  degrades acceptably (several pages already do), leave it alone rather
  than rewriting working layout
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold (`app/agent/layout.tsx`, the sidebar this story restructures), story 10-design (the token system and class patterns this extends — do not introduce new colors/spacing values outside that system). Run after story 09-tests so its suite is the regression baseline

## Extra notes (optional)

- Found during a direct visual check of the running app, not from the original spec or a prior codebase review.

## Technical hints (optional)

- The drawer's open/closed state is local `useState` in the new client component — no new global state, no URL param, no persistence needed; it should reset to closed on every fresh page load. Use a CSS transform (`-translate-x-full` / `translate-x-0`) gated by the open state and `md:translate-x-0` always-on for desktop, not a conditional render, so the slide transition animates instead of popping. `components/agent/sidebar-nav.tsx`'s own logic (link list, active-state highlighting) is unchanged — only how it's wrapped and shown/hidden changes. Prisma pinned to 6.19.3, though this story touches no backend code at all — flag it as a bug in scoping if any task here reaches into `app/api/**`. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Converting tables to a card-based mobile layout — horizontal scroll (already in place from story 10) stays as the mobile table pattern; a full data-display redesign is a separate, bigger story if ever picked up
  - Any change to component logic, data fetching, or routes — this is layout/CSS plus the one piece of new interactive state for the drawer itself
  - Tablet-specific fine-tuning beyond the standard `sm`/`md`/`lg` breakpoints already established by Tailwind and story 10
  - Automated visual-regression testing across breakpoints — verification here is manual devtools emulation, matching every other visual story in this plan
