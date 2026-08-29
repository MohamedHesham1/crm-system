# admin — plan overview

Entry point for the **admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 03 | [`03-story-admin-role-elevated-permissions-and-agent-account-management.md`](03-story-admin-role-elevated-permissions-and-agent-account-management.md) | Admin role: elevated permissions and agent account management | — | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), [`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md) |

## Dependency notes

- **Story 03 depends on Story 01** (commit `8534be4`) for `lib/roles.ts`, `middleware.ts`, `app/agent/layout.tsx`, `components/agent/sidebar-nav.tsx`, `lib/password.ts`, and `prisma/seed.ts` — it edits all six in place — and **on Story 02** (commit `fff097a`) for `lib/api/http.ts` and the `lib/customers.ts` client-module idiom.
- **Shared contracts introduced by Story 03** — later stories consume these rather than redefining them:
  - `lib/roles.ts` → a non-exported **`ROLE_CONFIG: Record<Role, { home; isStaff }>`** table, with `homeForRole()` and `isStaff()` derived from it. **This is the only place role-to-route and role-to-staff logic may live.** A new role is added by extending `ROLES` **and** `ROLE_CONFIG`; skipping the second half is a TS2741 compile error, by design.
  - `lib/api/http.ts` → **`requireAdmin()`** alongside `requireAgent()`. Same shape: `401` no session, `403` wrong role, `null` otherwise. Every `/api/admin/**` handler calls it first — `middleware.ts`'s matcher excludes `/api/**`.
  - `lib/api/client.ts` → **`ApiError`**, **`FieldErrors`**, and the shared **`request<T>()`**, extracted out of `lib/customers.ts` (which re-exports the first two for Story 02's importers). New client data modules import from `@/lib/api/client`; there must never be a second `ApiError` class, or `instanceof` checks fail silently across module copies.
  - `lib/users.ts` → `userKeys`, `fetchUsers`, `createUser`, and the `UserListItem` type (**no `passwordHash` field, ever**).
  - `lib/validation/user.ts` → `createUserSchema` and `CREATABLE_ROLES`. Shared by the route handler **and** the create form; do not fork a second schema.
  - `app/agent/admin/layout.tsx` → the ADMIN-only narrowing of the agent area. Any future admin-only page lives under `app/agent/admin/**` and inherits it; **non-admins are redirected to `/agent`**, never shown a 403 page.
- **Behaviour changed by Story 03** — later stories must assume the new semantics:
  - **`requireAgent()` now accepts ADMIN as well as AGENT.** ADMIN is a strict superset of AGENT; a handler that means "admin only" uses `requireAdmin()`.
  - **`homeForRole()` returns `/agent` for ADMIN.** Story 01's implementation returned `/portal` for every non-AGENT role, which misrouted ADMIN from both `app/page.tsx` and `middleware.ts`. Fixed here.
  - **`app/portal/layout.tsx` and `middleware.ts`'s portal branch are unchanged** — the portal stays CUSTOMER-only.
- **No migration.** `User.role` is already a `String` (SQLite has no Prisma `enum`), so ADMIN is a TypeScript-level change plus one seed row. `prisma/migrations/` gains no directory in this story.
- **Deferred out of Story 03:**
  - **Ticket reassignment authority** — named in the intake as ADMIN's other power, but belongs to a later story alongside the `Ticket` model.
  - **Editing and deactivating existing accounts**, and **password reset flows**. `/api/admin/users` is create + list only; there is no `PATCH`, no `DELETE`, and no user detail route.
  - **Granular permissions.** The split is flat: staff vs customer, admin vs not.
  - **Self-service admin signup.** Accounts are created by an existing ADMIN or by the seed script.
- **Still no automated test framework.** Stories 01 and 02 both deferred it and Story 03's intake does not ask for one either, so this ships a manual + `curl` test plan. Installing Vitest remains the open follow-up; Story 03's API items 1–10 convert directly into integration tests once a runner exists.
