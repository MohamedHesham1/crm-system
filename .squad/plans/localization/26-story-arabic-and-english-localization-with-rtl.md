# Story 26 — Arabic and English localization with RTL

## Prerequisites

- Stories 09, 10, 12, 19, and 25 completed for tests, design, responsive layouts, knowledge base, and brand strings.

---

## Story Goal

Add selectable English and Arabic, persistent locale preference, and
direction-aware RTL layout without translating user-authored database data.

---

## Context — Read These Files First

1. `app/layout.tsx` — root document and providers; locale must set `lang` and `dir` at document boundary.
2. `app/providers.tsx` — client provider wrapper; add locale context only if supported by current Next.js docs.
3. `app/globals.css` — tokens and direction-sensitive styles; avoid physical left/right assumptions.
4. `components/agent/sidebar-nav.tsx` and portal navigation — translate labels and verify mirrored navigation.
5. `tests/setup/dom.ts` — locale tests share existing jsdom setup.
6. Read relevant guide under `node_modules/next/dist/docs/` immediately before implementing Next.js routing/layout changes; this repository pins Next 16.3.3 with breaking changes.

---

## Implementation tasks

### 1 — Add locale dictionaries and persistence

**Create files: `lib/i18n/en.ts`, `lib/i18n/ar.ts`, `lib/i18n/locale.ts`**

- Define typed message keys and require both dictionaries to satisfy same type.
- Persist locale for guests and signed-in users; English default.
- Never use locale to authorize or scope data.

### 2 — Localize app-owned UI and document direction

**Files: `app/layout.tsx`, `components/agent/`, `components/portal/`, `components/ui/`**

- Set `lang`/`dir` to `en/ltr` or `ar/rtl`; localize navigation, forms, errors, notifications, statuses, FAQ/knowledge base labels, dashboard, reports, and account pages.
- Replace physical directional spacing/icons with logical CSS where needed.
- Isolate user-authored strings with bidi-safe rendering; do not translate stored content.

### 3 — Test dictionary and RTL coverage

**Create files under `tests/components/`**

- Test dictionary key parity, locale persistence, document attributes, and representative agent/portal flows.

---

## Edge Cases & Failure Modes

- Unknown stored locale falls back to English.
- Missing translation fails validation/test; never displays raw undefined key.
- User content containing mixed Arabic/Latin retains readable bidirectional order.
- RTL layout works at responsive breakpoints and in both themes.

---

## Test Plan

1. Dictionary parity/unit tests under `tests/components/` or existing test structure.
2. UI tests for locale selection, persistence, `lang`, and `dir`.
3. Run `npm test`, lint, build; manually inspect Arabic RTL on mobile and desktop.

---

## Verification Steps

1. **Frontend runs:** `npm run dev`; switch English/Arabic and confirm persistence on reload.
2. **Tests pass:** `npm test`.
3. **Regression:** test portal/agent critical flows in LTR and RTL.

---

## Done Criteria

- [ ] English/Arabic selectable and persistent; default English.
- [ ] App-owned strings localized and dictionaries complete.
- [ ] Correct document direction and readable RTL at mobile/desktop.
- [ ] User-authored data unchanged; tests pass.
