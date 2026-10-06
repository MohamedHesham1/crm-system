# Story 19 — Knowledge base articles, guides, and search

## Prerequisites

- Stories 03, 07, and 09 completed for admin authorization, portal, and tests.
- Article categories remain knowledge-base-owned; Story 20 system-wide ticket categories stay separate.

---

## Story Goal

Provide staff-managed help articles and guides searchable by customers in the
portal. Preserve existing FAQ access and never expose draft content.

---

## Context — Read These Files First

1. `lib/faq.ts` — `FAQ_ENTRIES` starts at line 10 and is currently static; preserve portal FAQ behavior while linking to managed articles.
2. `app/portal/faq/page.tsx` — existing portal FAQ page is under `app/portal/faq`; add knowledge-base search entry without breaking FAQ.
3. `app/agent/admin/layout.tsx` — `AdminLayout()` starts at line 6 and redirects non-admins; new authoring pages inherit this gate.
4. `app/api/admin/users/route.ts` — admin API `GET` is guarded by `withAuth({ role: "admin" })` at line 8; mirror this explicit route auth.

---

## Implementation tasks

### 1 — Add article model and validation

**Files: `prisma/schema.prisma`, `lib/validation/article.ts`, `prisma/migrations/`**

- Add article with title, unique slug, summary, body, category, status, author, publishedAt, and timestamps.
- Validate lengths, safe slug, publication transitions, and status enum as string tuple for SQLite.

### 2 — Add staff CRUD and customer search/read

**Create files: `app/api/admin/articles/route.ts`, `app/api/admin/articles/[id]/route.ts`, `app/api/knowledge-base/route.ts`, `app/api/knowledge-base/[slug]/route.ts`, `lib/articles.ts`**

- Admin routes use `withAuth({ role: "admin" })`.
- Customer read routes use `withAuth({ role: "viewer" })` and return only published records.
- Search title/summary/body/category in SQLite, enforce query length and bounded pagination; detail lookup never reveals existence of drafts.

### 3 — Add authoring/search UI

**Create files under `app/agent/admin/articles/` and `components/agent/admin/articles/`; add portal knowledge-base page/components under `app/portal/` and `components/portal/`**

- Add create/edit/publish/archive table and form; add search and article detail in portal.
- Keep FAQ route and navigation working; link FAQ to knowledge-base search.

### 4 — Test publication and search

**Create files: `tests/api/articles.test.ts`, `tests/components/knowledge-base.test.tsx`**

- Verify only published articles returned, slug uniqueness, admin access, search and pagination.

---

## Edge Cases & Failure Modes

- Draft/archived article requested by slug returns not found to customers.
- Duplicate slug returns field-level conflict; concurrent create still protected by unique DB constraint.
- Empty/overlong search gets validation response; result count bounded.
- Article body is rendered as escaped text unless a separately audited safe renderer is added.

---

## Test Plan

1. API tests in `tests/api/articles.test.ts`: role, lifecycle, search, duplicate slug, draft privacy.
2. UI tests in `tests/components/knowledge-base.test.tsx`: authoring and portal search states.
3. Run `npm test`.

---

## Migration / Rollback

- Add article table/indexes. Backup before rollback; preserve published article export before dropping table.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and `npm run build`.
2. **Tests pass:** `npm test`.
3. **Regression:** publish article and find it in portal search; unpublish and confirm all customer routes return not-found.

---

## Done Criteria

- [ ] Admin can author, edit, publish, unpublish, and archive articles.
- [ ] Portal search returns bounded published content only.
- [ ] Existing FAQ remains reachable.
- [ ] API auth, tests, and build pass.
