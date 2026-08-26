# scaffold — plan overview

Entry point for the **scaffold** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                                                           | Title                                                 | Tracker id | Depends on                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------- | ------------------------------ |
| 01  | [`01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md) | Next.js + TS scaffold: Prisma, Auth.js, base UI shell | —          | None (first story in the repo) |

## Dependency notes

- **Story 01 is the root of the dependency graph.** The repository has no commits and no application code; every later story assumes 01 has landed.
- **Shared contracts introduced by Story 01** — later stories consume these rather than redefining them:
  - `lib/roles.ts` — `Role` (`"AGENT" | "CUSTOMER"`), `isRole`, `homeForRole`. Roles are a **String** column, not a Prisma enum: SQLite does not support Prisma enums.
  - `lib/prisma.ts` — the `prisma` client singleton. Never construct `new PrismaClient()` in application code.
  - `auth.config.ts` (edge-safe) vs `auth.ts` (Node runtime). `middleware.ts` may import **only** `auth.config.ts`; importing `auth.ts`, `lib/prisma.ts`, or `lib/password.ts` there breaks the build.
  - Route conventions: `app/agent/**` = `AGENT`, `app/portal/**` = `CUSTOMER`, `app/(auth)/**` = public. Role checks live in each area's `layout.tsx` (authoritative); middleware handles redirect UX only.
  - `app/providers.tsx` — `SessionProvider` + TanStack Query `QueryClientProvider`, already mounted at the root layout.
- **Deferred out of Story 01:** no automated test framework is installed. Story 01 ships a manual smoke-test plan only. Installing the test harness (Vitest for units, and a browser runner if end-to-end coverage is wanted) is the first candidate for **Story 02**.
- **Out of scope for the whole feature:** real email/SMS/WhatsApp, ERP integration, multi-branch/department, custom branding, localization (English only).
