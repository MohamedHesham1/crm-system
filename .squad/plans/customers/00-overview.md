# customers — plan overview

Entry point for the **customers** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                                                       | Title                                            | Tracker id | Depends on                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| 02  | [`02-story-customer-profiles-model-api-and-management-ui.md`](02-story-customer-profiles-model-api-and-management-ui.md) | Customer profiles: model, API, and management UI | —          | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md) |

## Dependency notes

- **Story 02 depends on Story 01** (commit `8534be4`) for `lib/prisma.ts`, `auth.ts` / `auth.config.ts`, `lib/roles.ts`, the `app/agent/**` route group and its role guard in `app/agent/layout.tsx`, and the TanStack Query client mounted in `app/providers.tsx`.
- **Shared contracts introduced by Story 02** — later stories consume these rather than redefining them:
  - `prisma/schema.prisma` → **`Customer`** (`id`, `name`, `email` `@unique`, `phone`, `company?`, `notes` default `""`, `createdAt`, `updatedAt`).
  - `lib/validation/customer.ts` — `createCustomerSchema`, `updateCustomerSchema` and their inferred input types. Shared by the route handlers **and** the create form; do not fork a second schema.
  - `lib/api/http.ts` — `requireAgent`, `validationError`, `notFound`, `readJson`. **Every** route handler must call `requireAgent()` first: `middleware.ts`'s matcher excludes `/api/**`, so there is no ambient protection on API routes.
  - `lib/customers.ts` — `customerKeys` query-key factory, the typed fetchers, and the `ApiError` class carrying `status` + `fieldErrors`. New client data access goes through this module, not raw `fetch`.
  - API error contract: `400` `{ error, fieldErrors, formErrors }`, `401` / `403` `{ error }`, `404` `{ error }`, `409` `{ error, fieldErrors }`. Forms render `fieldErrors[name][0]` inline.
- **Deferred out of Story 02:**
  - **The `Ticket[]` relation on `Customer`.** A Prisma relation field to a model that does not exist yet fails validation with `P1012`; Story 02 leaves a `TODO(Story 03)` comment in the schema instead. **Story 03 adds the `Ticket` model and both sides of the relation in one new migration** — it must not edit the applied `add_customer` migration.
  - **Concurrent-edit protection on notes.** `PATCH` has no version column; last write wins. Adding optimistic locking is a separate story.
  - **List pagination, search, and sorting controls.** The list is a plain `ORDER BY name ASC` over all rows.
  - **Customer deletion** and **customer self-service profile editing** (`app/portal/**` is untouched — profiles are agent-managed).
  - **File/attachment upload on notes** — explicitly out of scope per the intake.
- **Still no automated test framework.** Story 01 deferred it and Story 02's intake does not ask for it, so both ship manual + `curl` test plans. Installing Vitest (and a browser runner for end-to-end coverage) remains the open follow-up; Story 02's API test items 1–8 convert directly into integration tests once a runner exists.
