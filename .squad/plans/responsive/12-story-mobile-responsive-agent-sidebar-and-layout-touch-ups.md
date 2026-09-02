# Story 12 — Mobile-responsive agent sidebar and layout touch-ups

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)). It owns `app/agent/layout.tsx`, the file whose `<aside>` (line 19) this story extracts, and `app/portal/layout.tsx`.
- **Story 09 completed and committed** ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md)). Its suite is the regression baseline: `npm test` must pass unchanged at the end of this story. No existing test renders `app/agent/layout.tsx` or `components/portal/top-nav.tsx`, so nothing in `tests/` should need editing — only the one new file in task 4.
- **Story 10 completed and committed** ([`../design/10-story-dark-light-mode-branding-and-a-visual-design-pass.md`](../design/10-story-dark-light-mode-branding-and-a-visual-design-pass.md)). It introduced `Wordmark`, `ThemeToggle`, the `text-meta` / `text-title` type scale, and the `bg-sidebar` / `border-sidebar-border` / `text-sidebar-foreground` tokens the current aside uses. **Do not introduce a colour, spacing, or type value outside that token system.** No new `oklch()` values, no new `--*` variables, no arbitrary hex.
- **Versions are pinned and must not move.** `next@16.3.3`, `react@19.2.8`, `react-dom@19.2.8`, `tailwindcss@^4`, `prisma@^6.19.3`, `lucide-react@^1.34.0`. **This story adds no dependency.** `lucide-react` already supplies the hamburger and close icons.
- **This story touches no backend code.** There is no change under `app/api/**`, `prisma/**`, `lib/` data modules, or any route handler. If a task appears to require one, that is a scoping bug — stop and report it rather than editing a route.

---

## Story Goal

Make the agent shell usable at phone width without changing anything about how it behaves at `md:` and above.

1. **The agent sidebar becomes a drawer below `md:`** — off-canvas by default, opened by a hamburger button in a mobile-only top bar, dimmed backdrop behind it, closing on backdrop click, on `Escape`, and on any nav link click.
2. **At `md:` and above the shell is byte-for-byte the current experience** — the aside is statically in the flex row, always visible, and neither the toggle button nor the backdrop is rendered at all.
3. **The portal top nav stops overflowing at phone width** — the right-hand cluster wraps and the raw email address is hidden below `sm:`.
4. **Two page containers get smaller mobile padding** — `p-8` becomes `p-4 md:p-8` in the two places it is used directly on an outer container.

**Not in scope**, and not to be added: card-based mobile table layouts (the `overflow-x-auto` wrapper at `components/ui/table.tsx:11` stays the mobile table pattern); any change to component logic, data fetching, routes, redirects, query keys, or response shapes; new breakpoints beyond Tailwind's `sm` / `md` / `lg`; body-scroll locking libraries or focus-trap dependencies; automated visual-regression testing across breakpoints. Verification here is manual devtools emulation, matching every other visual story in this plan.

---

## Context — Read These Files First

1. `app/agent/layout.tsx` — all 35 lines. **Line 18** is the `<div className="flex min-h-screen bg-surface-sunken">` row. **Line 19** is the `<aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">` this story replaces with `<SidebarShell>`. **Lines 20–28** are the aside's contents — `Wordmark`, `SidebarNav`, and the `mt-auto` footer block with the email, `SignOutButton` and `ThemeToggle`. **Lines 30–32** are `<main className="flex-1 p-8">` and its `max-w-6xl` inner wrapper.
2. `components/sign-out-button.tsx` — all 17 lines. **This is the constraint that decides the component's shape.** It imports `signOut` from `@/auth` and declares an inline `"use server"` action inside `<form action={…}>`, so it **cannot be imported by a client component**. `SidebarShell` therefore takes the aside's contents as a `children` prop rendered by the server layout — it must not import `SidebarNav`, `SignOutButton`, or the email paragraph itself.
3. `components/agent/sidebar-nav.tsx` — all 52 lines. Already `"use client"`. `BASE_LINKS` (10–15), `ADMIN_LINKS` (17–20), the `usePathname()` active check (31–32) and the link classes (38–43) are **unchanged by this story**. Note that every nav item renders as a plain `<Link>`, i.e. an `<a>` in the DOM — that is what the click-delegation close in task 1 keys off.
4. `components/agent/notification-bell.tsx` — lines 1–20. Rendered inside `SidebarNav` (line 28 of that file) and depends on a `QueryClientProvider`. It is why the new test in task 4 passes plain anchors as children instead of mounting `SidebarNav`.
5. `components/theme-toggle.tsx` — all 41 lines. Accepts a `className` prop (line 84) and is `"use client"`. Unchanged.
6. `components/brand/wordmark.tsx` — all 47 lines. Not marked `"use client"`, but it imports only `next/link`, `@/lib/brand` and `@/lib/utils`, so `SidebarShell` **may** import it directly for the mobile top bar. Its `href` and `showProduct` props are unchanged.
7. `components/portal/top-nav.tsx` — all 26 lines. **Line 10** is the `mx-auto flex max-w-4xl items-center justify-between px-6 py-3` bar. **Line 12** is the `flex items-center gap-4` cluster that overflows. **Line 19** is the `<span className="text-meta text-muted-foreground">{email}</span>` that gets hidden below `sm:`.
8. `app/portal/layout.tsx` — all 19 lines. **Line 16**: `<main className="mx-auto max-w-4xl space-y-6 p-8">`.
9. `components/ui/button.tsx` — lines 7–45. The `variant` and `size` maps. The toggle button uses `variant="ghost"` with `size="icon-sm"` (line 33, `size-7`), exactly as `ThemeToggle` does, so the two controls match.
10. `tests/components/theme-toggle.test.tsx` — all 24 lines. The pattern for a small interaction test: `render`, `userEvent.setup()`, query by accessible role and name. Match it.
11. `tests/components/customer-form.test.tsx` — **line 12**, `vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))`. This is the repo's precedent for mocking `next/navigation` in a `components` test; the new test mocks `usePathname` the same way.
12. `vitest.config.ts` — lines 36–51. The `components` project: `jsdom`, `include: ["tests/components/**/*.test.tsx"]`, `setupFiles: ["./tests/setup/dom.ts"]`, and the `next/link` alias to `tests/stubs/next-link.tsx`. **No config change is needed** for the new test.
13. Grep before starting task 3: `grep -rn "p-8\|px-8" --include=*.tsx app components` returns **exactly two hits** — `app/agent/layout.tsx:30` and `app/portal/layout.tsx:16`. Both are outer page containers, both are in scope. There is no third site; **do not widen the search into component-level padding.**
14. Grep before starting task 5: `grep -rn "grid-cols" --include=*.tsx app components` shows `components/agent/dashboard/summary-cards.tsx:11`, `components/agent/reports/sla-summary.tsx:13` and `components/agent/reports/ticket-breakdown-charts.tsx:22` already carry `sm:`/`lg:` prefixes and collapse to one column on phones. **They are already correct — leave them alone.**

---

## Product rules (from story)

| Rule | Current behaviour | New behaviour |
|---|---|---|
| Agent sidebar below `md:` | Fixed `w-60` aside inside a flex row; occupies ~60% of a 375 px viewport and squeezes `<main>` to nothing. | Off-canvas drawer, `-translate-x-full` when closed, `translate-x-0` when open, `transition-transform`. |
| Agent sidebar at `md:` and above | Always visible, static in the flex row. | **Identical.** `md:static md:translate-x-0`, no toggle button, no backdrop rendered. |
| Drawer trigger | None. | Hamburger `Button` in a `md:hidden` fixed top bar, `aria-expanded` + `aria-controls`. |
| Drawer dismissal | N/A. | Backdrop click, `Escape`, any nav-link click, and any pathname change. |
| Drawer state across page loads | N/A. | Local `useState`, initial `false`. Not persisted, not in the URL — a fresh load is always closed. |
| Portal top-nav cluster | Single `flex` row, `gap-4`, email always shown; overflows below ~420 px. | `flex-wrap` with a tighter mobile gap; email `hidden sm:inline`. |
| Outer page padding | `p-8` (2 rem) on both shells. | `p-4 md:p-8`. |

---

## Implementation tasks

`No backend changes required.`

### 1 — Create the client sidebar shell

**Create file: `components/agent/sidebar-shell.tsx`**

It owns three things and nothing else: the open/closed state, the mobile top bar with the toggle, and the wrapper markup (mobile bar, backdrop, `<aside>`). Every existing child — `Wordmark`, `SidebarNav`, the email paragraph, `SignOutButton`, `ThemeToggle` — arrives as `children` from the server layout, because `SignOutButton` is a server component (see Context item 2).

```tsx
"use client"

import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/brand/wordmark"

const SIDEBAR_ID = "agent-sidebar"

/**
 * Below `md:` the aside is a `fixed` off-canvas drawer moved by a transform,
 * **not** conditionally rendered — a `display:none` sibling has nothing for
 * `transition-transform` to animate, so it would pop instead of slide. At
 * `md:` and above `md:static md:translate-x-0` puts it back in the flex row
 * of `app/agent/layout.tsx:18` and the toggle and backdrop are `md:hidden`,
 * making desktop byte-for-byte what it was before this component existed.
 *
 * Children are passed in rather than imported: `SignOutButton` is a server
 * component with an inline `"use server"` action and cannot cross into a
 * client module.
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Backstop for a navigation the click handler below cannot see (browser
  // back/forward, a `router.push` from anywhere else). Clicking the link for
  // the page you are already on does not change `pathname`, which is exactly
  // why the click handler is also needed.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  // Delegation, so `SidebarNav` keeps its own logic untouched: any anchor
  // inside the drawer closes it on the same click that starts the
  // navigation, rather than leaving it open over the destination page.
  function handleNavClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false)
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls={SIDEBAR_ID}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XIcon /> : <MenuIcon />}
        </Button>
        <Wordmark href="/agent" />
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
        />
      ) : null}

      <aside
        id={SIDEBAR_ID}
        onClick={handleNavClick}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </aside>
    </>
  )
}
```

**Points that are not negotiable:**

- The class string on the `<aside>` keeps every class from `app/agent/layout.tsx:19` (`flex w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground`) and adds only positioning, `overflow-y-auto` and the transform. Changing a token here is out of scope.
- `overflow-y-auto` is new and required: as a `fixed inset-y-0` element the drawer no longer grows with the page, so on a short viewport the `mt-auto` footer block would otherwise be unreachable.
- The backdrop is a real `<button>`, not a `<div onClick>`, so it is reachable by keyboard and announced. It is `z-30`, the drawer `z-40`, so the drawer sits above it.
- `aria-controls` and the `id` must use the same `SIDEBAR_ID` constant.

### 2 — Wire the shell into the agent layout

**File: `app/agent/layout.tsx`**

Replace the `<aside>` element (line 19 and its closing tag at line 29) with `<SidebarShell>`, moving lines 20–28 inside it verbatim. Add the import; the file stays an `async` server component and the `auth()` / `redirect()` guards at lines 12–15 are untouched.

```tsx
import { SidebarShell } from "@/components/agent/sidebar-shell"
```

```tsx
  return (
    <div className="flex min-h-screen bg-surface-sunken">
      <SidebarShell>
        <Wordmark href="/agent" className="px-2 pt-1" />
        <SidebarNav role={session.user.role} />
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <p className="px-2 text-meta text-muted-foreground">{session.user.email}</p>
          <div className="flex items-center justify-between px-1">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </SidebarShell>
      <main className="flex-1 p-4 pt-18 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  )
```

`pt-18` (4.5 rem) clears the `h-14` (3.5 rem) mobile bar and leaves the same 1 rem gap `p-4` gives on the other three sides. `md:p-8` resets all four sides at desktop, so the padding there is exactly the current `p-8`. Tailwind v4 generates `pt-18` from the dynamic spacing scale — no config entry needed.

### 3 — Portal top nav and portal page padding

**File: `components/portal/top-nav.tsx`**

Line 10 — let the bar itself wrap, and use the smaller mobile gutter:

```tsx
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
```

Line 12 — let the cluster wrap and tighten its mobile gap:

```tsx
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
```

Line 19 — hide the raw email below `sm:`. It is duplicated information on a phone; the sign-out button next to it is the actionable control.

```tsx
          <span className="hidden text-meta text-muted-foreground sm:inline">{email}</span>
```

The two `<Link>`s (13–18), `SignOutButton` (20) and `ThemeToggle` (21) are unchanged.

**File: `app/portal/layout.tsx`**

Line 16:

```tsx
      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">{children}</main>
```

No `pt-` override here — the portal's `TopNav` is in normal flow, not `fixed`.

### 4 — Test the drawer

**Create file: `tests/components/sidebar-shell.test.tsx`**

Mount `SidebarShell` with plain anchors as children — **not** `SidebarNav`, which would pull in `NotificationBell` and require a `QueryClientProvider` for no added coverage. `usePathname` is mocked per the precedent at `tests/components/customer-form.test.tsx:12`. jsdom has no viewport-aware CSS, so the assertions are on the transform class and on state, which is exactly what the responsive classes are gated on.

```tsx
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({ usePathname: () => "/agent" }))

import { SidebarShell } from "@/components/agent/sidebar-shell"

function renderShell() {
  return render(
    <SidebarShell>
      <a href="/agent/tickets">Tickets</a>
    </SidebarShell>,
  )
}

describe("SidebarShell", () => {
  it("starts closed and slides open from the toggle", async () => { /* … */ })
  it("closes on backdrop click", async () => { /* … */ })
  it("closes when a nav link inside the drawer is clicked", async () => { /* … */ })
  it("closes on Escape", async () => { /* … */ })
})
```

Assertions, in order:

1. **Starts closed and opens.** `document.getElementById("agent-sidebar")` has class `-translate-x-full`; no element matches `screen.queryByRole("button", { name: "Close navigation" })`. Click `screen.getByRole("button", { name: "Open navigation" })`; the aside now has `translate-x-0` and not `-translate-x-full`, and the toggle's accessible name is `"Close navigation"` with `aria-expanded="true"`.
2. **Backdrop click closes.** Open, then click the backdrop — it is the `Close navigation` button that is **not** the toggle; select it with `screen.getAllByRole("button", { name: "Close navigation" })` and click the last one. Assert `-translate-x-full` is back.
3. **Nav-link click closes.** Open, then `await user.click(screen.getByRole("link", { name: "Tickets" }))`. Assert `-translate-x-full`. This is the delegation path and the acceptance criterion most likely to regress.
4. **Escape closes.** Open, then `await user.keyboard("{Escape}")`. Assert `-translate-x-full`.

Do not add a test that asserts desktop visibility — `md:static` is a media query jsdom does not evaluate, so such a test would assert nothing. Desktop parity is covered by the manual check in Verification step 4.

### 5 — Manual breakpoint sweep, fix only what is genuinely broken

Run the app and walk the pages listed below at 375 × 667 in devtools mobile emulation. **The default outcome of this task is "no code change".** Several pages already degrade acceptably and rewriting working layout is explicitly out of scope.

Already verified as correct from the greps in Context items 13–14 — **do not touch**:

- `components/agent/dashboard/summary-cards.tsx:11` and `components/agent/reports/sla-summary.tsx:13` — `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`, one column on phones.
- `components/agent/reports/ticket-breakdown-charts.tsx:22` — `grid gap-4 lg:grid-cols-2`, stacked on phones; the charts are `<ResponsiveContainer width="100%">` (line 27) so they track the container.
- Every table — `components/ui/table.tsx:11` wraps each one in `relative w-full overflow-x-auto`, the mobile table pattern kept by this story.
- `components/agent/tickets/ticket-detail.tsx:98` and `:185` — `flex flex-wrap items-center gap-4`; the widest child is a `w-48` (12 rem) `SelectTrigger` at line 203, which fits a 375 px viewport inside `p-4`.

Where the sweep does find real horizontal overflow or clipped content, fix it in place with the same `sm:`/`md:` prefix idiom and the existing tokens, and record the file and line in the commit message. Do not fix "it looks a bit tight".

---

## Edge Cases & Failure Modes

- **Clicking the nav link for the page you are already on.** `pathname` does not change, so the `useEffect` in `components/agent/sidebar-shell.tsx` never fires and the drawer would stay open over the same page. Handled by `handleNavClick`, the delegated `onClick` on the `<aside>`. Both mechanisms are required; removing either leaves a hole. Test 3 in task 4 covers it.
- **Browser back/forward while the drawer is open.** No click happens, so delegation cannot see it. The `pathname` effect closes it. Test coverage is indirect — verify manually in step 5.
- **Conditionally rendering the aside instead of transforming it.** `display:none` → `display:flex` has nothing to animate, so the drawer would pop rather than slide, failing the acceptance criterion. The aside must always be in the DOM; only its transform changes.
- **Desktop regression from a stale `open` state.** At `md:` the drawer must be visible regardless of state — `md:translate-x-0` is listed **after** `md:static` and, being a `md:` variant, wins over the unprefixed `-translate-x-full` in the same class list. If it is dropped, an agent who opened the drawer on a phone and rotated to tablet width gets a blank sidebar column. Verify by resizing across `md` with the drawer both open and closed.
- **Short viewport, tall sidebar.** As `fixed inset-y-0` the drawer no longer grows past the viewport, so on a 320 × 480 window with an ADMIN role (six nav links plus the notification bell) the `mt-auto` footer would be clipped. `overflow-y-auto` on the aside is what prevents it. Check with an ADMIN account.
- **Background scroll while the drawer is open.** Not locked — no scroll-lock dependency is in scope. The page behind can be scrolled by dragging the exposed strip to the right of the drawer. Accepted behaviour, not a defect; the backdrop still swallows taps.
- **Focus is not trapped in the drawer.** Tabbing past the last control moves into the page behind it. Accepted for this story; `Escape` and the backdrop are the documented exits. **Do not add a focus-trap dependency** to close this.
- **`z-index` collisions.** The drawer is `z-40` and the backdrop `z-30`. `components/ui/popover.tsx:33` and `components/ui/select.tsx:72` both render `z-50` through a portal, so the notification popover inside the drawer still layers above it. Confirm by opening the bell inside the mobile drawer.
- **The mobile bar overlapping page content.** The bar is `fixed`, so it is out of flow; `pt-18` on `<main>` is the only thing holding content clear of it. Drop it and every agent page's `<h1>` hides under the bar. Check `/agent` first — its heading sits at the very top of the content area.
- **Hiding the portal email below `sm:` on an account whose email is the only identifier shown.** After this change a phone user sees no email anywhere in the portal chrome. Accepted per the acceptance criteria ("hide the raw email text below `sm:`"); the sign-out button remains adjacent so the control is not orphaned.
- **`SignOutButton` imported into the client shell.** Would fail the build with a server-action-in-client-module error. `SidebarShell` takes `children`; it must not import that component. Named here because it is the most likely wrong turn when extracting the aside.

---

## Test Plan

1. **New, unit (`components` project):** `tests/components/sidebar-shell.test.tsx` — the four cases in task 4: opens from the toggle, closes on backdrop click, closes on a nav-link click, closes on `Escape`. Mocks `next/navigation`'s `usePathname`; passes plain anchors as children. Matches the shape of `tests/components/theme-toggle.test.tsx`.
2. **Unchanged, regression:** the six existing files under `tests/components/` and the seven under `tests/api/`. None renders `app/agent/layout.tsx`, `app/portal/layout.tsx` or `components/portal/top-nav.tsx`, so **no existing test file should be edited by this story.** An edit to one is a signal that a change went further than layout.
3. **No new test project or config entry.** `vitest.config.ts:44–50` already globs `tests/components/**/*.test.tsx` with the `jsdom` environment, the `next/link` stub and `tests/setup/dom.ts`.
4. **No automated breakpoint or visual-regression test.** Explicitly out of scope; step 5 of the tasks and steps 4–6 of Verification are the coverage.

---

## Verification Steps

1. **Types and lint:** `npx tsc --noEmit` then `npm run lint`, both in the repo root. Zero errors.
2. **Tests:** `npm test` in the repo root. The new `sidebar-shell` file passes and the pre-existing suite is green with no edits to it.
3. **Production build:** `npm run build` in the repo root. A server-action-in-client-component error here means `SidebarShell` imported `SignOutButton` — pass it as `children` instead.
4. **Desktop parity (the acceptance criterion most easily broken):** `npm run dev`, sign in as an agent, and at a viewport ≥ 768 px visit `/agent`, `/agent/tickets`, `/agent/tickets/<id>`, `/agent/reports`, `/agent/customers`. The sidebar is always visible, no hamburger and no mobile bar are rendered (confirm in the elements panel, not just visually), and `<main>` padding is unchanged at 2 rem. Sign in as ADMIN and confirm the Admin and Audit links still render.
5. **Drawer behaviour:** in devtools mobile emulation at 375 × 667 — the drawer is closed on load; the hamburger slides it in; the backdrop dims the page and closes it on tap; `Escape` closes it; tapping **Tickets** closes it and lands on `/agent/tickets` with the drawer shut; tapping the link for the current page also closes it; reloading any agent page leaves it closed. Open the notification bell inside the drawer and confirm the popover layers above it.
6. **Regression sweep at 375 px:** `/agent` (cards stack), `/agent/tickets` (table scrolls horizontally inside its own container, page body does not), `/agent/tickets/<id>` (status and priority selects wrap, description does not overflow), `/agent/reports` (charts stack and fill the width), `/portal`, `/portal/tickets`, `/portal/tickets/new`, `/portal/faq` (top-nav cluster wraps, no email, nothing clipped). In each case `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
7. **Short-viewport check:** at 320 × 480 as an ADMIN, open the drawer and scroll it to reach the sign-out button and theme toggle.

---

## Done Criteria

- [ ] `components/agent/sidebar-shell.tsx` exists as a `"use client"` component owning the drawer's `useState`, rendering the mobile bar, backdrop and `<aside>`, and receiving the aside's contents as `children`.
- [ ] Below `md:` the aside is off-canvas via `-translate-x-full` (not `display:none`), revealed by a hamburger toggle, with a semi-transparent backdrop that closes it on click.
- [ ] At `md:` and above: aside always visible and static in the flex row; neither toggle nor backdrop is present in the DOM; `<main>` padding is the same 2 rem as before.
- [ ] `Wordmark`, `SidebarNav`, `SignOutButton` and `ThemeToggle` are unchanged; `components/agent/sidebar-nav.tsx` has a zero-line diff.
- [ ] The drawer closes on nav-link click, on backdrop click, on `Escape`, and on pathname change; it is closed after every fresh page load.
- [ ] `components/portal/top-nav.tsx` wraps and hides the email below `sm:`; the portal chrome neither overflows nor clips at 375 px.
- [ ] Both `p-8` sites — `app/agent/layout.tsx:30` and `app/portal/layout.tsx:16` — are `p-4 … md:p-8`, and no other padding was changed.
- [ ] `tests/components/sidebar-shell.test.tsx` covers the four dismissal paths; `npm test` passes with no edits to any pre-existing test file.
- [ ] No new dependency in `package.json`; no file under `app/api/**`, `prisma/**` or `lib/` was touched.
- [ ] Manual 375 px sweep of dashboard, ticket detail, reports and the portal pages recorded; anything genuinely broken was fixed and named in the commit message, and already-acceptable layout was left alone.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 13.**
