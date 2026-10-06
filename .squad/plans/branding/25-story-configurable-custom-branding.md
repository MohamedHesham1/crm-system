# Story 25 — Configurable custom branding

## Prerequisites

- Stories 10, 12, 16, and 20 completed for theme, responsive shell, local file storage, and settings.

---

## Story Goal

Replace fixed installation branding with administrator-configured organization
name, logo, and validated palette. Preserve accessibility and default look
when settings are absent.

---

## Context — Read These Files First

1. `app/globals.css` — theme CSS variables start at line 1; extend approved tokens, do not inject arbitrary CSS.
2. `components/agent/sidebar-nav.tsx` and portal navigation — replace existing wordmark through shared brand component.
3. `app/layout.tsx` — root metadata and providers; load branding without breaking current theme.
4. `components/agent/admin/` — follow existing admin form patterns and admin layout.
5. Story 16 local storage service — store logo through authenticated asset path.

---

## Implementation tasks

### 1 — Extend installation settings

**Files: `prisma/schema.prisma`, `lib/validation/branding.ts`, `lib/settings.ts`**

- Add installation brand name, approved primary/accent colors, and logo attachment reference.
- Validate color format and contrast in light/dark palettes; reject CSS, HTML, or unapproved image formats.

### 2 — Add admin management and shared rendering

**Create files: `app/api/admin/branding/route.ts`, `app/agent/admin/branding/page.tsx`, `components/brand/wordmark.tsx`, `components/agent/admin/branding-form.tsx`**

- Settings API uses `withAuth({ role: "admin" })`.
- Apply brand to agent/portal nav, auth, metadata, and printable reports through shared components/tokens.
- Preserve deterministic defaults during initial render to avoid theme flash.

### 3 — Test settings and surfaces

**Create files: `tests/api/branding.test.ts`, `tests/components/branding.test.tsx`**

- Test permissions, defaults, color validation, image validation, and shared render locations.

---

## Edge Cases & Failure Modes

- Missing settings renders current brand defaults.
- Invalid colors fail validation; never inject arbitrary CSS.
- Missing/deleted logo falls back to wordmark without hiding failure from admin editor.
- Custom palette meets contrast thresholds in both themes.

---

## Test Plan

1. API tests for settings auth, defaults, and validation.
2. Component tests for admin editor, navigation, auth branding, and theme combinations.
3. Run `npm test`, lint, and build.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and build.
2. **Tests pass:** `npm test`.
3. **Regression:** configure brand and verify all app shells in light/dark; reset settings and verify defaults.

---

## Done Criteria

- [ ] Admin configures brand name/logo/colors.
- [ ] Brand applies consistently and uses safe stored image.
- [ ] Defaults and contrast remain correct in both themes.
- [ ] Tests pass.
