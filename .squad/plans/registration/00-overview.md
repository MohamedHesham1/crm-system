# registration — plan overview

Entry point for the **registration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 04 | [`04-story-customer-self-registration-with-automatic-account-linking.md`](04-story-customer-self-registration-with-automatic-account-linking.md) | Customer self-registration with automatic account linking | — | [`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), [`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), [`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md) |

## Dependency notes

- **Story 04 depends on Story 01** (commit `8534be4`) for the `(auth)` route group it extends — `app/(auth)/layout.tsx` is reused unchanged, and `login-form.tsx` / `actions.ts` are the pattern the register form copies — plus `lib/password.ts`, `middleware.ts`, and `prisma/seed.ts`, which it edits. **On Story 02** (commit `fff097a`) for the `Customer` model it adds a column to and `lib/validation/customer.ts`'s `emailField`. **On Story 03** (commit `ea52bab`) for `lib/api/http.ts`'s `readJson` / `validationError` and for `lib/validation/user.ts`'s second `emailField` copy, which Story 04 de-duplicates.
- **Shared contracts introduced by Story 04** — later stories consume these rather than redefining them:
  - `prisma/schema.prisma` → **`Customer.userId String? @unique`** with `user User? @relation(…, onDelete: SetNull)` and a `customer Customer?` back-reference on `User`. **This is the only supported way to go from a login to a customer profile.** Any later story that needs "the signed-in customer's profile" queries `prisma.customer.findUnique({ where: { userId: session.user.id } })` — **never** a match on `email`. Ticket ownership, portal-scoped queries, and per-customer authorization all hang off this column.
  - **`userId` is nullable and stays nullable.** An agent-created customer who never registered has no login, permanently. Code that reads the profile must handle `null` — a `CUSTOMER` login is *not* guaranteed to have one either (an admin could create the row and never link it).
  - `lib/registration.ts` → **`registerCustomer()`**, `RegisterResult`, `RegisterFailure`, and `REGISTER_ERRORS`. The **single** implementation of the match-then-link-or-create rule. `POST /api/register` and the `/register` server action are two entry points over this one function; a third caller imports it rather than re-deriving the logic.
  - `lib/validation/email.ts` → **`emailField`**, extracted from the two byte-identical copies in `lib/validation/customer.ts` and `lib/validation/user.ts`. Every schema that accepts an email imports it. There must never be a second definition — the `.trim().toLowerCase()` in it is the *only* thing making email matching case-insensitive, because **SQLite has no Prisma `mode: "insensitive"`**.
  - `lib/validation/register.ts` → `registerSchema`, `RegisterInput`. It has **no `role` field**, deliberately: role cannot be read from a public request body.
- **Behaviour changed by Story 04** — later stories must assume the new semantics:
  - **`/register` is public and unguarded**, both the page and `POST /api/register`. It is the first route in the app that anonymous users can `POST` to. Rate limiting is not implemented (see deferred).
  - **`middleware.ts`'s `isLogin` becomes `isAuthPage`** (`/login` **or** `/register`). A third auth page is added to that expression, not to a new branch.
  - **`prisma/seed.ts`'s `customer@crm.local` now has a linked `Customer` row.** The three `*.example` customers stay unlinked on purpose — they are the fixtures for the match-then-link path.
  - **A self-registered `Customer` has `phone: ""`.** `Customer.phone` is still `String` (non-null, no default); the empty string comes from `registerCustomer`, not from the schema. Any UI that assumes a non-empty phone is wrong.
- **One migration.** `prisma/migrations/<timestamp>_add_customer_user_link/` — SQLite cannot `ALTER TABLE` in a foreign-key column, so Prisma emits a table redefinition (`new_Customer`, copy, drop, rename). That is expected; the migration preserves rows and ends with both `Customer_email_key` and `Customer_userId_key`.
- **Deferred out of Story 04:**
  - **Email verification.** Named in the intake as a **known, accepted risk**: without it, anyone who knows an agent-created customer's email can claim that profile. Recorded in `registerCustomer`'s doc comment so it is discoverable from the code. An agent-controlled "allow portal signup" flag on `Customer` is the suggested mitigation, and is explicitly *not* built here.
  - **Password reset, phone-based registration, OAuth / social login.**
  - **Rate limiting and bot protection on `/api/register`.** Not in the acceptance criteria; the first thing to add if this ever faces the public internet.
  - **Surfacing the link in the agent UI.** `app/api/customers/route.ts`'s `select` still omits `userId`, so the customer table cannot show "has a portal login". A one-field change when a story needs it.
  - **Unlinking or re-linking a profile from the admin area.** `Customer.userId` is written only by `registerCustomer` and the seed. There is no endpoint to change it, which is why `registerCustomer`'s `"customer-claimed"` branch is currently unreachable — it exists to stay correct the day that endpoint ships.
  - **`lib/validation/auth.ts` was deliberately left on the older `.email()` chaining.** `loginSchema` is on the sign-in hot path and refactoring it belongs to a story that touches sign-in.
- **Still no automated test framework.** Stories 01–03 all deferred it and Story 04's intake does not ask for one either, so this ships a manual + `curl` test plan. Story 04's Test Plan items 3–9 convert directly into integration tests once a runner exists — the `registerCustomer` extraction was designed so those tests can call one function instead of driving a browser.
