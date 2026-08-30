# Story 10 — Dark/light mode, branding, and a visual design pass

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md)). Owns the four files this story rewrites the most: `app/globals.css` (the `@theme inline` block at lines 7–49 and the `:root` / `.dark` palettes at 51–118), `app/layout.tsx` (the `next/font/google` calls at lines 6–14), `app/providers.tsx` (the single `SessionProvider` + `QueryClientProvider` — **add `ThemeProvider` to it; do not create a second providers file**), and the three shells `app/agent/layout.tsx`, `app/portal/layout.tsx`, `app/(auth)/layout.tsx`.
- **Stories 02–08 completed and committed.** Every page this story restyles was built by one of them. Nothing in those stories' logic changes here.
- **Story 09 completed and committed** ([`../tests/09-story-test-coverage-across-the-application.md`](../tests/09-story-test-coverage-across-the-application.md), commit `b3b922d`). **This story is bounded by that suite.** `npm test` must pass unchanged at the end. The single most constraining assertion in the repo is `tests/components/assigned-ticket-list.test.tsx:37` — read the first bullet of `## Edge Cases & Failure Modes` before touching the SLA badge.
- **Versions are pinned and must not move.** `next@16.3.3`, `react@19.2.8`, `react-dom@19.2.8`, `tailwindcss@^4`, `shadcn@^4.19.0`, `recharts@^3.10.1`, `lucide-react@^1.34.0`. **Do not run `npm install <pkg>@latest`** on anything already in `package.json`.
- **One new runtime dependency: `next-themes`.** Install exactly `npm install next-themes@0.4.6` (current version is `0.4.6`; its `peerDependencies` are `react: ^16.8 || ^17 || ^18 || ^19 || ^19.0.0-rc` and the same for `react-dom`, verified with `npm view next-themes version peerDependencies`). It is the **only** new dependency in this story. No icon pack, no font package, no CSS library — `lucide-react` is already installed and `next/font/google` self-hosts the typefaces.

---

## Story Goal

Give the application a single, deliberate visual identity and a working light/dark theme, changing **presentation only**.

1. **A theme that actually switches.** `next-themes` mounted in `app/providers.tsx` with `attribute="class"`, defaulting to system preference, persisted in `localStorage`, with no flash of the wrong theme on first paint and no page reload on toggle. A toggle control in the agent sidebar and in the portal top nav.
2. **A real token system**, extending the CSS variables already in `app/globals.css` rather than sitting beside them: the shadcn variable *names* stay, their *values* are replaced by a designed palette, and a small set of new named tokens (`--brand`, `--signal`, `--surface-sunken` and friends) is added and registered in `@theme inline` so Tailwind utilities exist for them.
3. **A named type scale** expressed as Tailwind v4 `--text-*` theme entries — `text-display`, `text-title`, `text-subtitle`, `text-body`, `text-meta`, `text-label`, `text-metric` — replacing the ad hoc `text-2xl font-semibold` / `text-sm text-muted-foreground` pairs currently repeated across every page.
4. **Two typefaces, loaded once**: **Archivo** for headings and the wordmark, **Public Sans** for body and UI. Both are self-hosted by `next/font/google`. `Geist` and `Geist_Mono` are removed — see task 1 for why keeping them would mean paying for four families to render two.
5. **One signature**: the SLA-breach treatment. Amber is reserved for time pressure and appears nowhere else in the app.
6. **A placeholder wordmark** — "Meridian Service Desk" — replacing the literal strings `"CRM"` (`app/agent/layout.tsx:18`) and `"CRM Portal"` (`components/portal/top-nav.tsx:9`), driven from one constant so renaming the product is a one-line edit.

**Not in scope**, and not to be added: any change to component logic, data fetching, routes, redirects, status codes, query keys, `staleTime` values, or response shapes; custom illustration or graphic assets; marketing animation; per-tenant theming; a designed logo asset; any theme option beyond light/dark/system; storing the theme preference in the database; mobile-specific layout work beyond the basic responsiveness already present.

---

## The design direction (decide once, here)

The subject is an internal ticketing desk that staff sit in front of all day and customers visit when something is broken. The direction is **"operations desk"**: cool graphite neutrals, a deep harbour teal-blue as the primary, dense table-first layouts, moderate radius, and exactly one warm colour — amber — held in reserve for SLA and time state.

Three defaults are **explicitly forbidden** by the acceptance criteria and must not appear in the implementation:

1. Cream / off-white ground with a high-contrast serif display face and a terracotta accent. — There is **no serif** in this story and no warm-neutral background; `--background` is a cool near-white in light mode.
2. Near-black ground with a single bright neon or vermilion accent. — Dark mode's `--background` is `oklch(0.196 0.014 258)`, a blue-grey graphite, not `#0a0a0a`; the accent is a desaturated amber, not neon.
3. Broadsheet layout with hairline rules and zero border-radius. — `--radius` stays at a visible `0.5rem` and surfaces are cards with borders, not rule-separated columns.

Why this reads as a support tool rather than a template: status is carried by **colour temperature**, not by decoration. Cool = steady state, amber = the clock is running out, red = an error the operator hit. That mapping is enforced by making amber a token (`--signal`) that only the SLA treatment consumes.

---

## Context — Read These Files First

1. `app/globals.css` — all 129 lines. **Lines 7–49** are the `@theme inline` block; note that **line 10 (`--font-sans: var(--font-sans);`) is self-referential and resolves to nothing**, and line 12 (`--font-heading: var(--font-sans);`) inherits that nothing. Line 11 maps `--font-mono` to `--font-geist-mono`. **Lines 51–84** are `:root`, **86–118** are `.dark`; every colour is `oklch(L 0 0)` — a pure greyscale — except `--destructive` (66, 101) and the stray `--sidebar-primary: oklch(0.488 0.243 264.376)` at **line 112**, which is the shadcn default purple and the only saturated value in the file. **Lines 120–129** are the `@layer base` block.
2. `app/layout.tsx` — all 32 lines. Lines 6–14 declare `geistSans` with `variable: "--font-geist-sans"` and `geistMono` with `variable: "--font-geist-mono"`; line 25 puts both variables on `<html>`. **`--font-geist-sans` is never read by any CSS rule** — that is the other half of the `--font-sans` defect, and it means the app currently renders in the browser's default sans. Lines 16–19 are the `metadata` object with `title: "CRM"`.
3. `app/providers.tsx` — all 22 lines. The `QueryClient` is created inside `useState` (lines 8–15) so it survives re-render; the nesting order at 18–21 is `SessionProvider` → `QueryClientProvider`. `ThemeProvider` goes **outermost**.
4. `components/ui/card.tsx` — all 103 lines. **Line 15**: the `Card` surface — `rounded-xl`, `ring-1 ring-foreground/10`, and the `[--card-spacing:--spacing(4)]` local variable the header, content and footer all read. **Line 41**: `CardTitle` already applies `font-heading`, so pointing `--font-heading` at Archivo restyles every card title with no markup change.
5. `components/ui/table.tsx` — all 116 lines. **Lines 9–12**: the `data-slot="table-container"` wrapper, which is where the shared table surface belongs. **Lines 22–29** `TableHeader`, **55–66** `TableRow` (`hover:bg-muted/50`), **68–79** `TableHead`, **81–92** `TableCell`. Six components render tables through these primitives, so one edit here reaches all of them.
6. `components/ui/badge.tsx` — all 49 lines. The `destructive` variant is at **line 16**. `Badge` renders a `<span data-slot="badge" data-variant=…>` (37–46) and spreads `className`, so a new visual treatment needs no new variant — pass classes.
7. `components/agent/dashboard/assigned-ticket-list.tsx` — all 51 lines. **Line 43** is the SLA badge inside the `TableCell` at 40–45; **line 27** is the `<TableRow>` that gains `data-sla`. `tests/components/assigned-ticket-list.test.tsx` renders this exact component.
8. `tests/components/assigned-ticket-list.test.tsx` — all 41 lines. **Line 37**: `expect(screen.getAllByText("SLA breached")).toHaveLength(1)`. **Line 38**: `screen.getByRole("row", { name: /Breached ticket/ })`.
9. `components/agent/sidebar-nav.tsx` — all 52 lines. `BASE_LINKS` (10–15) and `ADMIN_LINKS` (17–20) are the nav model; the active-link classes at **38–43** use `bg-accent` / `text-accent-foreground`, so `--accent` must stay a **surface** tint and must not become the brand amber.
10. `components/portal/top-nav.tsx` — all 23 lines. Lines 8–10 are the `"CRM Portal"` wordmark link; 11–20 is the right-hand cluster the theme toggle joins.
11. `app/agent/layout.tsx` — all 28 lines. **Line 17** the `<aside>` (`w-60`, `bg-muted/30`), **line 18** the literal `"CRM"`, **lines 20–23** the footer block, **line 25** the `<main className="flex-1 p-8">`.
12. `components/agent/reports/ticket-breakdown-charts.tsx` — all 53 lines. Lines 29–32 and 44–47: `CartesianGrid` and both axes render with **recharts defaults**, which are hard-coded light-mode greys. This is the file where dark mode currently breaks hardest.
13. Grep before starting task 9: `grep -rn "text-2xl font-semibold" app components` returns the ten `<h1>` sites plus five metric `<span>`s; `grep -rn "text-sm text-muted-foreground" app components` returns the meta and loading-text sites.
14. [`../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md`](../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md) — the precedent for touching the reports page and the chart components without touching `lib/report-metrics.ts`.

---

## Product rules (from story)

| Rule | Current behaviour | New behaviour |
|---|---|---|
| Theme | Light only. `.dark` exists at `app/globals.css:86` but nothing ever adds the class. | System preference on first visit; user choice persisted in `localStorage` under `next-themes`' default key; `.dark` toggled on `<html>`. |
| Typography | No webfont is actually applied — `--font-sans` is undefined, so the browser default sans renders. | Public Sans (body) and Archivo (headings), self-hosted, applied through `--font-sans` / `--font-heading`. |
| Colour | Pure greyscale plus one red and one stray purple. | Harbour teal-blue primary, cool graphite neutrals, amber `--signal` reserved for SLA state, red kept for errors. |
| Type sizes | Chosen per page: `text-2xl font-semibold`, `text-lg font-medium`, `text-sm text-muted-foreground`, `text-xs`. | Named scale: `text-display`, `text-title`, `text-subtitle`, `text-body`, `text-meta`, `text-label`, `text-metric`. |
| SLA breach | `<Badge variant="destructive">SLA breached</Badge>`, four call sites, no other signal. | One `SlaBadge` component in amber plus an inset amber rail on the breached table row. Rendered text is unchanged. |
| Wordmark | Literal `"CRM"` and `"CRM Portal"`. | `<Wordmark />` driven by `lib/brand.ts`. |

---

## Implementation tasks

### 1 — Install `next-themes`; replace the fonts; fix the `--font-sans` defect

**Run:** `npm install next-themes@0.4.6` in the repo root.

**File: `app/layout.tsx`**

Replace the font imports and declarations (lines 2, 6–14), the `metadata` object (16–19) and the `<html>` element (23–26).

```tsx
import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { Providers } from "./providers";

// Two families, both variable, both self-hosted by next/font — no runtime
// request to Google. `Geist`/`Geist_Mono` are gone: `--font-geist-sans` was
// never read by any CSS rule and `font-mono` is used nowhere in the app, so
// keeping them would have meant paying for four families to render two.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.fullName, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Required by next-themes: its pre-hydration script writes `class` and
      // `style` on this element, which React would otherwise report as a
      // hydration mismatch on every load.
      suppressHydrationWarning
      className={`${publicSans.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Do not pass `weight`** to either call. Both faces are variable (`Archivo` exposes `wdth` and `wght`; `Public Sans` exposes `wght`), and omitting `weight` loads the variable font, which is what makes a 400/500/600 type scale free.

`app/portal/faq/page.tsx:6–9` already exports its own `metadata` with `title: "FAQ"`; the new `template` turns that into `"FAQ · Meridian"` automatically. Leave that file's metadata alone.

---

### 2 — Create the brand constant

**Create file: `lib/brand.ts`**

```ts
/**
 * Placeholder branding. The wordmark, the document title and the portal nav
 * all read from here, so renaming the product is a one-line edit and never a
 * find-and-replace across JSX.
 */
export const BRAND = {
  name: "Meridian",
  product: "Service Desk",
  fullName: "Meridian Service Desk",
  description: "Ticketing and customer support for internal teams",
} as const
```

No other module may hard-code the product name after this task.

---

### 3 — Rewrite the token system in `app/globals.css`

This is the centre of the story. The file keeps its shape — imports, `@custom-variant`, `@theme inline`, `:root`, `.dark`, `@layer base` — and gains two blocks: a plain `@theme` for the static scale, and an `@layer components` for the SLA rail.

**File: `app/globals.css`**

**3a. Fix the font mappings in the existing `@theme inline` block.** Delete lines 10–12 (`--font-sans`, `--font-mono`, `--font-heading`) from `@theme inline` — font families are static strings, not runtime-swappable variables, so they belong in a plain `@theme` block. Then **add** the new colour mappings alongside the existing `--color-*` entries in the same block:

```css
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-soft: var(--brand-soft);
  --color-signal: var(--signal);
  --color-signal-foreground: var(--signal-foreground);
  --color-signal-soft: var(--signal-soft);
  --color-surface-sunken: var(--surface-sunken);
```

Those seven mappings are what make `bg-signal-soft`, `text-signal-foreground`, `bg-surface-sunken` and `text-brand` real Tailwind utilities. **Every other `--color-*` line in that block stays exactly as it is** — the shadcn variable names are the contract that every file under `components/ui/` depends on.

**3b. Add a new `@theme` block** (not `inline`) immediately after the `@theme inline` block, holding the fonts and the type scale:

```css
@theme {
  --font-sans: var(--font-public-sans), ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", sans-serif;
  --font-heading: var(--font-archivo), var(--font-public-sans), ui-sans-serif,
    system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* The type scale. Seven sizes, no more. Anything reaching for a raw
     `text-2xl` / `text-xs` in app code after this story is a bug. */
  --text-display: 1.75rem;
  --text-display--line-height: 2.125rem;
  --text-display--font-weight: 600;
  --text-display--letter-spacing: -0.02em;

  --text-title: 1.125rem;
  --text-title--line-height: 1.5rem;
  --text-title--font-weight: 600;
  --text-title--letter-spacing: -0.01em;

  --text-subtitle: 0.9375rem;
  --text-subtitle--line-height: 1.375rem;
  --text-subtitle--font-weight: 600;

  --text-body: 0.875rem;
  --text-body--line-height: 1.375rem;
  --text-body--font-weight: 400;

  --text-meta: 0.8125rem;
  --text-meta--line-height: 1.25rem;
  --text-meta--font-weight: 400;

  --text-label: 0.6875rem;
  --text-label--line-height: 1rem;
  --text-label--font-weight: 600;
  --text-label--letter-spacing: 0.06em;

  --text-metric: 1.625rem;
  --text-metric--line-height: 2rem;
  --text-metric--font-weight: 600;
  --text-metric--letter-spacing: -0.02em;
}
```

`--font-mono` deliberately resolves to a system stack: `font-mono` is used nowhere in the app (`grep -rn "font-mono" app components` returns only the `globals.css` mapping), so loading a mono webfont would be pure cost.

**3c. Replace the body of `:root` (lines 52–83).** Keep every variable name; replace every value.

```css
:root {
  /* Cool near-white ground, graphite ink. Not cream — see the design
     direction note above. */
  --background: oklch(0.984 0.003 247);
  --foreground: oklch(0.235 0.019 258);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.235 0.019 258);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.235 0.019 258);

  /* Harbour teal-blue. Primary is a working colour: buttons, links, focus
     rings, the wordmark mark. */
  --primary: oklch(0.452 0.078 216);
  --primary-foreground: oklch(0.985 0.005 220);
  --secondary: oklch(0.955 0.006 247);
  --secondary-foreground: oklch(0.315 0.023 258);
  --muted: oklch(0.958 0.005 247);
  --muted-foreground: oklch(0.532 0.021 257);

  /* `--accent` is shadcn's *hover surface*, not a brand accent. It stays a
     near-neutral tint; `components/agent/sidebar-nav.tsx:41` paints the
     active nav item with it. The brand accent is `--signal`, below. */
  --accent: oklch(0.945 0.012 240);
  --accent-foreground: oklch(0.315 0.023 258);

  --destructive: oklch(0.546 0.184 26);
  --border: oklch(0.902 0.008 250);
  --input: oklch(0.902 0.008 250);
  --ring: oklch(0.452 0.078 216);

  --chart-1: oklch(0.452 0.078 216);
  --chart-2: oklch(0.588 0.094 205);
  --chart-3: oklch(0.688 0.098 178);
  --chart-4: oklch(0.705 0.148 62);
  --chart-5: oklch(0.556 0.132 38);

  --radius: 0.5rem;

  --sidebar: oklch(0.968 0.005 247);
  --sidebar-foreground: oklch(0.235 0.019 258);
  --sidebar-primary: oklch(0.452 0.078 216);
  --sidebar-primary-foreground: oklch(0.985 0.005 220);
  --sidebar-accent: oklch(0.928 0.014 222);
  --sidebar-accent-foreground: oklch(0.300 0.045 216);
  --sidebar-border: oklch(0.898 0.008 250);
  --sidebar-ring: oklch(0.452 0.078 216);

  /* New named tokens — the part of the system that is ours, not shadcn's. */
  --brand: oklch(0.452 0.078 216);
  --brand-foreground: oklch(0.985 0.005 220);
  --brand-soft: oklch(0.938 0.028 216);
  --signal: oklch(0.705 0.148 62);
  --signal-foreground: oklch(0.268 0.058 62);
  --signal-soft: oklch(0.948 0.048 76);
  --surface-sunken: oklch(0.962 0.005 247);
}
```

**3d. Replace the body of `.dark` (lines 87–117).**

```css
.dark {
  /* Blue-grey graphite, not near-black. */
  --background: oklch(0.196 0.014 258);
  --foreground: oklch(0.945 0.005 247);
  --card: oklch(0.238 0.016 258);
  --card-foreground: oklch(0.945 0.005 247);
  --popover: oklch(0.238 0.016 258);
  --popover-foreground: oklch(0.945 0.005 247);
  --primary: oklch(0.742 0.088 205);
  --primary-foreground: oklch(0.196 0.028 216);
  --secondary: oklch(0.288 0.017 258);
  --secondary-foreground: oklch(0.945 0.005 247);
  --muted: oklch(0.288 0.017 258);
  --muted-foreground: oklch(0.712 0.017 257);
  --accent: oklch(0.312 0.021 250);
  --accent-foreground: oklch(0.945 0.005 247);
  --destructive: oklch(0.685 0.162 25);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 16%);
  --ring: oklch(0.742 0.088 205);

  --chart-1: oklch(0.742 0.088 205);
  --chart-2: oklch(0.668 0.086 195);
  --chart-3: oklch(0.782 0.092 172);
  --chart-4: oklch(0.792 0.138 72);
  --chart-5: oklch(0.672 0.132 42);

  --sidebar: oklch(0.172 0.013 258);
  --sidebar-foreground: oklch(0.912 0.006 247);
  /* Was `oklch(0.488 0.243 264.376)` — the shadcn default purple, and the
     only saturated hue in the old greyscale palette. Deliberately removed. */
  --sidebar-primary: oklch(0.742 0.088 205);
  --sidebar-primary-foreground: oklch(0.196 0.028 216);
  --sidebar-accent: oklch(0.288 0.024 216);
  --sidebar-accent-foreground: oklch(0.945 0.005 247);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.742 0.088 205);

  --brand: oklch(0.742 0.088 205);
  --brand-foreground: oklch(0.196 0.028 216);
  --brand-soft: oklch(0.318 0.041 212);
  --signal: oklch(0.792 0.138 72);
  --signal-foreground: oklch(0.918 0.062 76);
  --signal-soft: oklch(0.352 0.062 62);
  --surface-sunken: oklch(0.172 0.013 258);
}
```

`--signal-foreground` is **not** the same relationship in both themes: in light mode it is a dark brown-amber on a pale amber chip; in dark mode it is a pale amber on a deep amber chip. Do not "simplify" them to one value.

**3e. Extend the `@layer base` block (lines 120–129) and add an `@layer components` block:**

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground text-body;
  }
  html {
    @apply font-sans;
  }
  h1,
  h2,
  h3 {
    @apply font-heading text-balance;
  }
}

@layer components {
  /* The signature. A breached row carries an inset amber rail on its first
     cell; the badge in that row carries the same amber. Applied to the cell
     rather than the `<tr>` because a `box-shadow` on a table-row does not
     paint reliably across border-collapse modes. Amber is the *only* place
     this hue appears in the app — that is what makes it read as a signal. */
  [data-sla="breached"] > td:first-child {
    box-shadow: inset 2px 0 0 0 var(--signal);
  }
}
```

Adding `text-body` to `body` is what makes 14px/22px the default and lets the page-level `text-sm` classes disappear in task 9.

---

### 4 — Mount `ThemeProvider`

**File: `app/providers.tsx`**

`ThemeProvider` goes **outermost**, so a theme change never remounts the query cache or the session.

```tsx
"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    // `attribute="class"` matches `app/globals.css:5`'s
    // `@custom-variant dark (&:is(.dark *))` and the `.dark` selector at
    // line 86 — a `data-theme` attribute would toggle nothing.
    // `disableTransitionOnChange` suppresses the colour-transition sweep that
    // every `transition-colors` element would otherwise run on toggle.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
```

**Do not** add a second provider component, and **do not** touch the `QueryClient` options — `staleTime: 30_000` and `refetchOnWindowFocus: false` are Story 01's contract and Story 09 asserts behaviour that depends on them.

---

### 5 — The theme toggle

**Create file: `components/theme-toggle.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/**
 * `useTheme()` cannot know the resolved theme during SSR or the first client
 * render, so the icon is rendered only after mount. The button itself is
 * always present, at a fixed size, so the nav does not reflow on hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : null}
    </Button>
  )
}
```

`size="icon-sm"` exists at `components/ui/button.tsx:32–33`. The `aria-label` is the button's only accessible name — it is what makes the control findable by a screen reader and by Test Plan item 4.

---

### 6 — The wordmark

**Create file: `components/brand/wordmark.tsx`**

```tsx
import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * Placeholder branding, not a designed logo: a geometric mark in the brand
 * colour plus the name in the heading face. Both come from tokens, so the
 * wordmark inverts with the theme like everything else.
 */
export function Wordmark({
  href,
  showProduct = false,
  className,
}: {
  href: string
  showProduct?: boolean
  className?: string
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-5 shrink-0 text-brand"
      >
        <rect x="1" y="1" width="18" height="18" rx="5" fill="currentColor" opacity="0.16" />
        <path
          d="M5 13.5 L10 5 L15 13.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-heading text-title leading-none">
        {BRAND.name}
        {showProduct ? (
          <span className="ml-1.5 text-meta font-normal text-muted-foreground">
            {BRAND.product}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
```

`text-brand` is a real utility only after task 3a adds `--color-brand`. Verify that before assuming the mark is coloured.

---

### 7 — The signature: the SLA-breach treatment

**Create file: `components/ui/sla-badge.tsx`**

```tsx
import type { ReactNode } from "react"
import { ClockAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * The one bold thing in the app. Amber (`--signal`) means "the clock ran
 * out" and appears nowhere else; red stays reserved for errors the operator
 * hit (the `role="alert"` paragraphs). Paired with the inset amber rail
 * defined in `app/globals.css`'s `@layer components` block, which fires off
 * `data-sla="breached"` on the row.
 *
 * **The rendered text must be the direct text content of this one span.**
 * `tests/components/assigned-ticket-list.test.tsx:37` asserts
 * `getAllByText("SLA breached")` has length 1; wrapping the children in an
 * inner element would make both that element and this one match, and the
 * test would fail with "found multiple elements".
 */
export function SlaBadge({
  children = "SLA breached",
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-signal/40 bg-signal-soft text-signal-foreground font-medium",
        className,
      )}
    >
      <ClockAlertIcon aria-hidden="true" />
      {children}
    </Badge>
  )
}
```

Confirm `ClockAlertIcon` is exported by the installed `lucide-react@^1.34.0` before committing:
`node -e "console.log(!!require('lucide-react').ClockAlertIcon)"`. If it is not, use `AlarmClockIcon`; **do not** add an icon dependency.

**Swap the four call sites.** Each is a one-line replacement; no surrounding markup moves.

| File | Line | Replacement |
|---|---|---|
| `components/agent/dashboard/assigned-ticket-list.tsx` | 43 | `<Badge variant="destructive">SLA breached</Badge>` → `<SlaBadge />` |
| `components/agent/tickets/ticket-table.tsx` | 199 | same → `<SlaBadge />` |
| `components/agent/tickets/ticket-detail.tsx` | 77 | same → `<SlaBadge />` |
| `components/agent/dashboard/summary-cards.tsx` | 30 and 43 | `<Badge variant="destructive">{n} breached</Badge>` → `<SlaBadge>{n} breached</SlaBadge>` |

**Add the row rail** in the two components that render breached rows:

- `components/agent/dashboard/assigned-ticket-list.tsx:27` — `<TableRow key={ticket.id}>` becomes `<TableRow key={ticket.id} data-sla={ticket.slaBreached ? "breached" : undefined}>`.
- `components/agent/tickets/ticket-table.tsx:162` — the same change on that `<TableRow>`.

`data-sla={undefined}` renders no attribute at all, so a healthy row is untouched in the DOM. **Do not** write `data-sla={ticket.slaBreached ? "breached" : "ok"}` — an attribute that is always present makes "breached rows only" harder to assert.

After the swap, `grep -rn 'variant="destructive"' components` must return exactly one hit: `components/agent/notification-bell.tsx:47`, the unread count. That one is intentionally left alone — an unread count is not a time signal.

---

### 8 — The three shells

**File: `app/agent/layout.tsx`** — replace lines 16–26.

```tsx
  return (
    <div className="flex min-h-screen bg-surface-sunken">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
        <Wordmark href="/agent" className="px-2 pt-1" />
        <SidebarNav role={session.user.role} />
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <p className="px-2 text-meta text-muted-foreground">{session.user.email}</p>
          <div className="flex items-center justify-between px-1">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  )
```

Import `Wordmark` from `@/components/brand/wordmark` and `ThemeToggle` from `@/components/theme-toggle`. `bg-muted/30` on the aside is replaced by the real `bg-sidebar` token — which is the point of the eight sidebar variables having sat unused since Story 01. The `mx-auto max-w-6xl` wrapper is the one structural addition in this task: it stops tables running the full width of a 27-inch monitor, and it is a wrapper, not a restructure.

**File: `components/agent/sidebar-nav.tsx`** — only the class string at lines 38–43 changes:

```tsx
              className={cn(
                "rounded-md px-3 py-2 text-meta font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
```

`BASE_LINKS`, `ADMIN_LINKS`, the `isActive` computation at 31–32 and the `NotificationBell` at line 28 are **untouched**.

**File: `components/portal/top-nav.tsx`** — replace the returned markup.

```tsx
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Wordmark href="/portal" showProduct />
        <div className="flex items-center gap-4">
          <Link href="/portal/tickets" className="text-meta text-muted-foreground hover:text-foreground">
            My tickets
          </Link>
          <Link href="/portal/faq" className="text-meta text-muted-foreground hover:text-foreground">
            FAQ
          </Link>
          <span className="text-meta text-muted-foreground">{email}</span>
          <SignOutButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
```

The `email` prop and both link targets are unchanged. `TopNav` stays a server component; `ThemeToggle` is a client child, which is legal and requires no change to `app/portal/layout.tsx` beyond what follows.

**File: `app/portal/layout.tsx`** — line 14 becomes `<div className="min-h-screen bg-surface-sunken">`; line 16 becomes `<main className="mx-auto max-w-4xl space-y-6 p-8">`.

**File: `app/(auth)/layout.tsx`** — line 5 becomes:

```tsx
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-sunken p-4">
```

with `<Wordmark href="/login" showProduct />` added above `{children}` so login and register carry the identity too. This is the only markup addition to the `(auth)` group; `login-form.tsx` and `register-form.tsx` are **not** restructured.

---

### 9 — Apply the type scale to every page

Mechanical and exhaustive. Every page named in the acceptance criteria appears below; none may be skipped. In every row the JSX structure is unchanged — only class strings move.

| Page | File | Change |
|---|---|---|
| Login | `app/(auth)/login/page.tsx` | line 15 `text-sm text-muted-foreground` → `text-meta text-muted-foreground`. `Card`/`CardTitle` inherit the new tokens; no other edit. |
| Register | `app/(auth)/register/page.tsx` | line 15, same change. |
| Agent dashboard | `app/agent/page.tsx` | line 11 `text-2xl font-semibold` → `text-display`; line 12 → `text-meta text-muted-foreground`. |
| Dashboard body | `components/agent/dashboard/dashboard-overview.tsx` | lines 24, 27 `text-sm` → `text-meta`; line 35 `text-lg font-medium` → `text-title`. |
| Dashboard cards | `components/agent/dashboard/summary-cards.tsx` | lines 18, 28, 41 `text-2xl font-semibold` → `text-metric tabular-nums`. |
| Tickets list | `app/agent/tickets/page.tsx` | line 10 → `text-display`. |
| Tickets table | `components/agent/tickets/ticket-table.tsx` | lines 121, 136, 145 `text-sm` → `text-meta`; 139, 209 → `text-meta text-destructive`. |
| Ticket detail | `components/agent/tickets/ticket-detail.tsx` | line 76 → `text-display`; lines 70, 79, 85, 86, 89, 92, 179 → `text-meta text-muted-foreground`; lines 100, 122, 157 `text-xs font-medium text-muted-foreground` → `text-label uppercase text-muted-foreground`; line 95 `text-sm` → `text-body`; lines 47, 51, 219 → `text-meta`; line 156 `rounded-lg border p-4` → `rounded-lg border bg-card p-4`. |
| Comment thread | `components/agent/tickets/comment-thread.tsx` | line 50 `text-lg font-semibold` → `text-title`; the `text-sm` / `text-xs` meta lines → `text-meta` / `text-label`. |
| Customers list | `app/agent/customers/page.tsx` | line 10 → `text-display`. |
| Customer detail | `components/agent/customers/customer-profile.tsx` | line 51 → `text-display`; lines 46, 52–57, 90 → `text-meta text-muted-foreground`; lines 31, 35, 93 → `text-meta`. |
| New customer | `app/agent/customers/new/page.tsx` | none — `Card` carries it. |
| Admin users list | `app/agent/admin/users/page.tsx` | line 10 → `text-display`. |
| Admin create account | `app/agent/admin/users/new/page.tsx` | none. |
| Audit trail | `app/agent/admin/audit/page.tsx` | line 6 → `text-display`. |
| Audit table | `components/agent/admin/audit-table.tsx` | lines 50, 53, 59 `text-sm` → `text-meta`. |
| Reports | `app/agent/reports/page.tsx` | line 10 → `text-display`. The comment at 11–13 stays verbatim. |
| Reports body | `components/agent/reports/reports-overview.tsx` | lines 24, 27 → `text-meta`. |
| SLA cards | `components/agent/reports/sla-summary.tsx` | lines 19, 33, 43 `text-2xl font-semibold` → `text-metric tabular-nums`; lines 22, 34, 44 `text-xs` → `text-label uppercase`. |
| CSAT card | `components/agent/reports/csat-summary.tsx` | line 67 → `text-metric tabular-nums`; lines 71, 77 `text-xs` → `text-label`; line 81 `bg-[var(--chart-1)]` → `bg-chart-1`. |
| Agent performance | `components/agent/reports/agent-performance-table.tsx` | `text-sm` / `text-xs` → `text-meta` / `text-label`; numeric cells gain `tabular-nums`. |
| Portal home | `app/portal/page.tsx` | line 8 → `text-display`; line 9 → `text-meta text-muted-foreground`. |
| Portal tickets list | `app/portal/tickets/page.tsx` | line 10 → `text-display`. |
| Portal list body | `components/portal/tickets/portal-ticket-list.tsx` | lines 16, 20, 27 `text-sm` → `text-meta`. |
| Portal ticket detail | `components/portal/tickets/portal-ticket-detail.tsx` | line 31 → `text-display`; lines 35, 37 → `text-meta text-muted-foreground`; line 39 `text-sm` → `text-body`; lines 17, 21 → `text-meta`. |
| Portal new ticket | `app/portal/tickets/new/page.tsx` | none. |
| Portal FAQ | `app/portal/faq/page.tsx` | line 15 → `text-display`; line 16 → `text-meta text-muted-foreground`; line 27 → `text-body text-muted-foreground`. |
| Feedback form | `components/portal/tickets/feedback-form.tsx` | `text-sm` / `text-xs` → `text-meta` / `text-label`. |
| The six forms | `login-form.tsx`, `register-form.tsx`, `customer-form.tsx`, `ticket-form.tsx`, `user-form.tsx`, `portal-ticket-form.tsx` | error and helper paragraphs `text-sm` → `text-meta`. **No `<form>`, `<Label>`, `name`, `id`, `value` or handler may change** — `tests/components/customer-form.test.tsx:29` submits via `container.querySelector("form")`. |

**Acceptance gate for this task:** `grep -rn "text-2xl\|text-3xl\|text-xl\|text-lg" app components --include="*.tsx" | grep -v "components/ui/"` returns **nothing**. Occurrences inside `components/ui/` are shadcn's own primitives and stay.

---

### 10 — Consistent card and table surfaces

Two edits reach every list and detail page, which is why this task exists instead of touching six table components.

**File: `components/ui/table.tsx`**

Lines 9–12, the container:

```tsx
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-lg border bg-card"
    >
```

Lines 22–29, the header:

```tsx
    <thead
      data-slot="table-header"
      className={cn("bg-surface-sunken [&_tr]:border-b", className)}
      {...props}
    />
```

Lines 68–79, `TableHead`: `font-medium` becomes `text-label uppercase text-muted-foreground`, so column headers read as labels rather than as data.

**File: `components/ui/card.tsx`** — line 15 only: swap `ring-1 ring-foreground/10` for `border` so cards and tables share one edge treatment, and `rounded-xl` for `rounded-lg` so they share one radius. The `[--card-spacing:--spacing(4)]` local variable and every `data-slot` stay exactly as they are; `components/ui/card.tsx:41`'s `font-heading` now resolves to Archivo with no edit at all.

After this task, `customer-table.tsx`, `user-table.tsx`, `audit-table.tsx`, `ticket-table.tsx`, `portal-ticket-list.tsx` and `assigned-ticket-list.tsx` all pick up the same surface without a single edit in those files.

---

### 11 — Make the charts theme-aware

**File: `components/agent/reports/ticket-breakdown-charts.tsx`**

recharts' defaults are hard-coded light-mode greys (`CartesianGrid` stroke `#ccc`, axis ticks `#666`, `Tooltip` a white panel with a `#ccc` border). In dark mode they are close to invisible against `--card`. Both `BarChart` blocks (lines 28–34 and 43–49) get the same four changes:

```tsx
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: "0.8125rem",
              }}
            />
```

`fill="var(--chart-1)"` (line 33) and `fill="var(--chart-2)"` (line 48) already resolve through the token system and are correct as written — only their **values** changed, in task 3. The two `<Card>` wrappers and both `ResponsiveContainer height={240}` values are unchanged; Story 08 requires an explicit height on every `ResponsiveContainer`, so do not remove it.

---

### 12 — Sweep for hard-coded colour

Final pass before verification:

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" app components --include="*.tsx" --include="*.css"
grep -rn "bg-\[.*\]\|text-\[#\|border-\[#" app components --include="*.tsx"
grep -rn "bg-white\|bg-black\|text-white\|text-black\|bg-gray-\|text-gray-\|bg-slate-\|text-slate-" app components --include="*.tsx"
```

All three must return nothing outside `components/ui/`. Any hit is a colour that will not invert with the theme.

---

## Edge Cases & Failure Modes

- **`getAllByText("SLA breached")` finding two elements.** `tests/components/assigned-ticket-list.test.tsx:37` asserts exactly one match. Testing Library matches a text query against `node.textContent`, which includes descendants, so **any** wrapper element whose only text is "SLA breached" also matches. If `SlaBadge` renders `<Badge><span>{children}</span></Badge>`, both the badge and the inner span match and the test fails with "found multiple elements". Enforced by keeping `children` a direct child of `Badge` in `components/ui/sla-badge.tsx`. An `<svg>` sibling contributes no text and is safe.
- **The row's accessible name.** The same test does `getByRole("row", { name: /Breached ticket/ })` at line 38. A row's accessible name is the concatenation of its cells' text. Adding visible text to a cell still satisfies the regex, but **removing** the subject link at `assigned-ticket-list.tsx:29–31` would break it. Do not touch that cell.
- **Flash of the wrong theme.** Caused by omitting `suppressHydrationWarning` on `<html>`, or by mounting `ThemeProvider` below a component that renders theme-dependent markup. Enforced at `app/layout.tsx`'s `<html>` element and by `ThemeProvider` being outermost in `app/providers.tsx`. Verify by loading with the OS in dark mode and watching the first paint, not by toggling.
- **Hydration mismatch in the toggle.** `useTheme().resolvedTheme` is `undefined` during SSR and the first client render. Rendering `{isDark ? <SunIcon/> : <MoonIcon/>}` without the `mounted` guard produces a mismatch warning on every load. Enforced by the `mounted` state in `components/theme-toggle.tsx`; the button element itself always renders, so the nav does not reflow.
- **`window.matchMedia` is not implemented in jsdom.** `tests/setup/dom.ts` stubs `hasPointerCapture`, `scrollIntoView` and `ResizeObserver` (lines 12–26) but not `matchMedia`. `ThemeProvider` with `enableSystem` calls it. No existing test mounts a component that touches the theme, so the current suite is unaffected — but a new test that renders `ThemeToggle` or `TopNav` throws `window.matchMedia is not a function`. Test Plan item 2 adds the stub.
- **`--font-sans` still resolving to nothing.** The self-reference at `app/globals.css:10` is the current defect. If task 3b's `@theme` block is added but line 10 is not deleted from `@theme inline`, the fonts can silently fail to apply. Verify by inspecting the computed `font-family` on `<body>` in devtools — it must start with the hashed `__Public_Sans_*` family name, not `ui-sans-serif`.
- **A theme-dependent colour baked into an inline `style`.** `components/agent/reports/csat-summary.tsx:82–88` sets `width` inline — that is a layout value and is fine. An inline `style={{ color: "#333" }}` anywhere would not invert. Caught by the task 12 sweep.
- **`--accent` repurposed as the brand accent.** `components/agent/sidebar-nav.tsx:41` paints the active nav item with `bg-accent`, and `components/ui/button.tsx` and `select.tsx` use it for hover states. Making it amber would flood the UI with the signal colour and destroy the signature. Enforced by keeping `--accent` a near-neutral tint and introducing `--signal` separately in both `:root` and `.dark`.
- **Dark-mode contrast on the amber chip.** `--signal-foreground` is a dark amber in light mode and a pale amber in dark mode; one value for both leaves the badge unreadable in one theme. Both are defined explicitly in tasks 3c and 3d.
- **`localStorage` unavailable.** In a private window with storage disabled, `next-themes` falls back to the system preference on every load and the toggle works for the session only. The app must not crash; `next-themes` handles this internally — do not wrap it in `try`/`catch`.
- **The `(auth)` pages have no toggle.** Login and register render inside `app/(auth)/layout.tsx`, which has no nav. They still follow the system preference, because `ThemeProvider` is mounted at the root. This is intended; do not add a floating toggle to those pages.
- **A page-level `metadata` export losing its title.** `app/portal/faq/page.tsx:6–9` exports `title: "FAQ"`. The new `template` in `app/layout.tsx` renders that as `"FAQ · Meridian"`. If the template is written without the `default` key, every page that does not export its own title loses one.

---

## Test Plan

The suite is Vitest (`npm test` → `vitest run`, `package.json:11`), split into an `api` project (node) and a `components` project (jsdom) by `vitest.config.ts:25–52`. **No API test may change** — this story touches no route.

1. **Regression, unmodified — `npm test`.** All six API test files and all four component test files pass with no edits. `tests/components/assigned-ticket-list.test.tsx` is the one that fails first if task 7 is done wrong.
2. **Modify `tests/setup/dom.ts`** — append a `window.matchMedia` stub in the same style as the three existing ones (lines 12–26), guarded by `if (!globalThis.matchMedia)`, returning an object with `matches: false`, `media`, `onchange: null`, and no-op `addListener` / `removeListener` / `addEventListener` / `removeEventListener` / `dispatchEvent`. Additive only; the existing stubs stay exactly as they are.
3. **New unit test — `tests/components/sla-badge.test.tsx`.** Render `<SlaBadge />` and assert `screen.getAllByText("SLA breached")` has length **1**. This pins the invariant that `tests/components/assigned-ticket-list.test.tsx:37` depends on, at the component that owns it, so a future wrapper element fails a focused test instead of a distant one. Second case: render `<SlaBadge>3 breached</SlaBadge>` and assert `getByText("3 breached")` is in the document.
4. **New unit test — `tests/components/theme-toggle.test.tsx`.** Wrap `<ThemeToggle />` in `<ThemeProvider attribute="class">` from `next-themes`; find the button with `getByRole("button", { name: /Switch to (light|dark) theme/ })`, click it with `userEvent`, and assert `document.documentElement.classList.contains("dark")` flipped. Requires item 2. Follow the mount pattern in `tests/helpers/render.tsx` but do **not** reuse `renderWithQuery` — this component needs no `QueryClientProvider`.
5. **Manual — first-visit default.** Clear `localStorage`, set the OS to dark, load `/login`. The page renders dark on **first paint**, with no white flash. Repeat with the OS in light mode.
6. **Manual — persistence.** Toggle to dark on `/agent`, hard-reload. Still dark. In a second browser profile, the customer portal's preference is independent.
7. **Manual — no reload on toggle.** Open `/agent/tickets`, apply a status filter, toggle the theme. The filter selection survives, the Network tab shows no request to `/api/tickets`, and no full document load occurs.
8. **Manual — the signature.** On `/agent` with at least one breached ticket assigned, the breached row shows the amber rail on its first cell and the amber `SLA breached` chip; healthy rows show neither and carry **no** `data-sla` attribute in the inspector. Repeat on `/agent/tickets` and on a breached ticket's detail page.
9. **Manual — amber is used once.** Search the rendered page in devtools for `var(--signal)`. The only consumers are the SLA rail and `SlaBadge`.
10. **Manual — every page, both themes.** Walk all of them in light and then in dark: `/login`, `/register`, `/agent`, `/agent/tickets`, `/agent/tickets/[id]`, `/agent/tickets/new`, `/agent/customers`, `/agent/customers/[id]`, `/agent/customers/new`, `/agent/admin/users`, `/agent/admin/users/new`, `/agent/admin/audit`, `/agent/reports`, `/portal`, `/portal/tickets`, `/portal/tickets/[id]`, `/portal/tickets/new`, `/portal/faq`. Every one must show the wordmark or a card surface consistent with the others, `text-display` on its `<h1>`, and no element that fails to invert.
11. **Manual — charts in dark mode.** `/agent/reports` as ADMIN. Grid lines, axis labels and the tooltip panel are legible against the dark card; bars use the teal and amber chart tokens.
12. **Manual — empty and error states.** With an empty database, the "No tickets match these filters.", "No customers yet. Create the first one." and "Nothing new." strings render at `text-meta` in the muted colour in both themes. Force an error (stop the dev server mid-query) and confirm the `role="alert"` paragraphs are **red**, not amber.
13. **Manual — focus visibility.** Tab through `/agent/tickets` in both themes. The focus ring (`--ring`, now the brand teal) is visible on every button, link, select trigger and on the theme toggle.
14. **Manual — fonts actually load.** Devtools Network tab filtered to Font: exactly two families are requested, from the app's own origin, and **no** request goes to `fonts.googleapis.com` or `fonts.gstatic.com`.

---

## Verification Steps

1. **Dependency installed:** `npm install next-themes@0.4.6` in the repo root. `npm ls next-themes` resolves to `0.4.6` with no unmet peer warnings against `react@19.2.8`. No other line in `package.json` moved — confirm with `git diff package.json`.
2. **Types build:** `npx tsc --noEmit` in the repo root. Zero errors.
3. **Lint passes:** `npm run lint` in the repo root. Zero errors.
4. **Tests pass:** `npm test` in the repo root. Every pre-existing test passes **unmodified**; the only changes under `tests/` are the `matchMedia` stub (Test Plan item 2) and the two new files (items 3 and 4).
5. **Production build:** `npm run build` in the repo root. This is the step that catches a missing `"use client"` in `components/theme-toggle.tsx` and a Tailwind token referenced but never registered in `@theme inline`; `dev` will not.
6. **Frontend runs:** `npm run dev`, then walk Test Plan items 5–14 at `http://localhost:3000`.
7. **Type scale is exhaustive:** `grep -rn "text-2xl\|text-3xl\|text-xl\|text-lg" app components --include="*.tsx" | grep -v "components/ui/"` returns nothing.
8. **No hard-coded colour:** the three greps in task 12 return nothing outside `components/ui/`.
9. **No stale branding:** `grep -rn "\"CRM\"\|CRM Portal\|Geist" app components lib` returns nothing.
10. **Regression — no behaviour moved:** `git diff --stat` touches **no** file under `app/api/`, no file under `lib/` except the new `lib/brand.ts`, and nothing in `prisma/`, `auth.ts`, `auth.config.ts` or `middleware.ts`. `git diff app/ components/` contains no change to a `useQuery` key, a `staleTime`, a `mutationFn`, a `redirect(...)`, an `href`, a form `name`/`id`, or an `aria-*` attribute other than the toggle's new `aria-label`.

---

## Done Criteria

- [ ] `next-themes@0.4.6` is the **only** new dependency; no pinned version in `package.json` moved.
- [ ] `ThemeProvider` is mounted **outermost** in `app/providers.tsx` with `attribute="class"`, `defaultTheme="system"`, `enableSystem` and `disableTransitionOnChange`; `SessionProvider` and `QueryClientProvider` are unchanged inside it, and no second providers file exists.
- [ ] `<html>` in `app/layout.tsx` carries `suppressHydrationWarning`; first paint matches the OS preference on a cleared `localStorage`, with no flash.
- [ ] A `ThemeToggle` is present in the agent sidebar and the portal top nav, switches without a reload, persists across sessions, and renders no icon before mount.
- [ ] `Geist` and `Geist_Mono` are gone. `Archivo` and `Public_Sans` are each loaded once from `next/font/google` with no `weight` option, and **exactly two** font families are requested at runtime, from the app's own origin.
- [ ] `--font-sans` and `--font-heading` resolve to real families: the computed `font-family` on `<body>` starts with the hashed Public Sans name, and `CardTitle` (`components/ui/card.tsx:41`) renders in Archivo.
- [ ] `app/globals.css` defines `--brand`, `--brand-foreground`, `--brand-soft`, `--signal`, `--signal-foreground`, `--signal-soft` and `--surface-sunken` in **both** `:root` and `.dark`, and all seven are registered in `@theme inline` as `--color-*`.
- [ ] Every shadcn variable name from Story 01 still exists; only values changed. `--sidebar-primary` in `.dark` is no longer `oklch(0.488 0.243 264.376)`.
- [ ] The type scale `--text-display|title|subtitle|body|meta|label|metric` exists in a plain `@theme` block, and no file outside `components/ui/` uses `text-2xl`, `text-3xl`, `text-xl` or `text-lg`.
- [ ] Every page listed in task 9 — both `(auth)` pages, every agent page, every portal page — uses the named scale for its heading, body and meta text.
- [ ] All six tables share one surface via `components/ui/table.tsx`, cards and tables share one radius and one edge treatment, and no list or detail page styles its own table.
- [ ] The SLA-breach treatment is the single signature: `SlaBadge` plus the `[data-sla="breached"]` rail, in amber, and `grep -rn "var(--signal)\|signal-soft\|signal-foreground" app components` shows those tokens consumed **only** by `app/globals.css` and `components/ui/sla-badge.tsx`.
- [ ] All four former `<Badge variant="destructive">…breached…</Badge>` call sites use `SlaBadge`; `variant="destructive"` survives only at `components/agent/notification-bell.tsx:47`.
- [ ] `SlaBadge` renders "SLA breached" as the direct text of one element, and `tests/components/assigned-ticket-list.test.tsx` passes unmodified.
- [ ] `Wordmark` reads `BRAND` from `lib/brand.ts`, appears in the agent sidebar, the portal top nav and the `(auth)` shell, and no file hard-codes `"CRM"` or `"CRM Portal"`.
- [ ] `document.title` on `/portal/faq` reads `"FAQ · Meridian"`, and every other page falls back to `"Meridian Service Desk"`.
- [ ] `components/agent/reports/ticket-breakdown-charts.tsx` passes token colours to `CartesianGrid`, both axes and `Tooltip`; the reports page is legible in dark mode.
- [ ] None of the three forbidden directions is present: no serif face anywhere, no cream background, no near-black background with a neon accent, and `--radius` is a non-zero `0.5rem`.
- [ ] No file under `app/api/`, `prisma/`, `middleware.ts`, `auth.ts` or `auth.config.ts` is touched; `lib/brand.ts` is the only new file under `lib/`.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm test` all pass.

**STOP HERE. Report to the user and wait for confirmation.**
