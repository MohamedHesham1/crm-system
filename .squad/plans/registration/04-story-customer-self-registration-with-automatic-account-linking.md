# Story 04 — Customer self-registration with automatic account linking

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). This story mirrors and edits its files: `app/(auth)/layout.tsx` (reused unchanged), `app/(auth)/login/page.tsx`, `app/(auth)/login/login-form.tsx`, `app/(auth)/login/actions.ts` (the pattern to copy), `lib/password.ts`, `middleware.ts`, `prisma/seed.ts`.
- **Story 02 completed and committed** ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), commit `fff097a`). It owns the `Customer` model (`prisma/schema.prisma:25–38`), the `@unique` email, and `lib/validation/customer.ts`'s `emailField` idiom. This story adds a column to that model.
- **Story 03 completed and committed** ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`). It owns `lib/api/http.ts` (`readJson`, `validationError`), `lib/validation/user.ts` (the second `emailField` copy this story de-duplicates), and `lib/roles.ts`.
- **Versions are pinned and must not move.** `package.json`: `next@16.3.3`, `react@19.2.8`, `prisma@^6.19.3`, `@prisma/client@^6.19.3`, `zod@^4.4.3`, `next-auth@^5.0.0-beta.32`, `bcryptjs@^3.0.3`. The intake pins Prisma at **6.19.3** — **do not** run `npm install <pkg>@latest`.
- **No new npm dependency and no new shadcn/ui component.** `Card`, `Input`, `Label`, `Button` already exist under `components/ui/`.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed`. `## Test Plan` below is manual + `curl`, matching Stories 01–03.

---

## Story Goal

Give customers a **public** way to create their own portal login, and make the relationship between a login and a customer profile an **explicit foreign key** instead of a coincidence of matching email strings.

1. **`Customer.userId String? @unique`** with a real Prisma relation to `User`. **Nullable on purpose** — an agent-created customer who has never registered has no login, and that is a valid, permanent state.
2. **`app/(auth)/register/`** — a public page (name, email, password) in the existing `(auth)` route group, using the same `Card` shell and the same `useActionState` + server-action pattern as the login page.
3. **`POST /api/register`** — public, **no auth guard**, the programmatic surface for the same operation.
4. **One transactional match-then-link-or-create rule**, shared by the page and the route so their behaviour cannot drift:
   - A `User` already holds that email → **reject**.
   - An **unlinked** `Customer` (`userId IS NULL`) holds that email → create the `User` (role `CUSTOMER`) and set that row's `userId`.
   - Otherwise → create the `User` and a new `Customer` **in the same transaction**.
5. **Auto sign-in on success**, then redirect to `/portal`.
6. **The seed's `customer@crm.local` login gets a linked `Customer` row** — the exact shape a real registration produces, with no special-casing.

**Not in scope** (intake, "Out of scope"): email verification, password reset, phone-based registration, an agent-controlled "allow portal signup" toggle, OAuth/social login. **The accepted risk is explicit:** with no email verification, anyone who knows a customer's email address can claim that customer record. That is acceptable for this build and must be recorded in a code comment (task 5), not silently ignored.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — lines 13–21 (`User`) and 23–38 (`Customer`). Note **line 16** (`User.email @unique`) and **line 28** (`Customer.email @unique`) — both uniqueness constraints matter to task 5. Lines 35–37 are a `TODO(Story 03)` comment about a future `Ticket` model; **leave it alone**, it is not this story's work.
2. `prisma/migrations/20260826132926_add_customer/migration.sql` — all 14 lines. The house style for a generated SQLite migration and the existing `Customer_email_key` unique index. Task 2 adds a second unique index next to it.
3. `lib/validation/customer.ts` — lines 3–12. The `emailField` idiom: `.trim().toLowerCase()` **before** `.pipe(z.email(…))`, with the comment explaining that SQLite compares text case-sensitively so normalisation must happen in the schema. This is the **only** correct email idiom in this repo.
4. `lib/validation/user.ts` — lines 5–14. A **verbatim second copy** of the same `emailField`. Task 3 extracts both into one module; this story would otherwise add a third copy.
5. `lib/validation/auth.ts` — all 8 lines. **Read this to know what not to copy.** Line 4 uses the older `z.string().trim().toLowerCase().email(…)` chaining. The intake says to reuse "the normalization already established in `lib/validation/auth.ts`" — the *normalisation* (`.trim().toLowerCase()`) is right, the `.email()` **chaining** is the deprecated Zod 4 form that Story 03 already ruled out. Follow `lib/validation/customer.ts:8–12` instead. `loginSchema` itself is **not** modified by this story.
6. `app/(auth)/login/actions.ts` — all 37 lines. The server-action contract task 7 mirrors: `"use server"`, a `{ error?: string }` state object, `safeParse` first, then `await signIn("credentials", { email, password, redirectTo })` inside a `try` that catches **only** `AuthError` and **rethrows everything else** (line 33). That rethrow is load-bearing — see Edge Cases.
7. `app/(auth)/login/login-form.tsx` — all 52 lines. `useActionState` (line 23), the nested `SubmitButton` using `useFormStatus` (lines 13–20), uncontrolled `<Input name=…>` fields, and the `role="alert"` error paragraph (lines 43–47). Task 8 is this component with one extra field and per-field errors.
8. `app/(auth)/login/page.tsx` — all 16 lines. The `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` shell. Task 9 copies it; task 10 adds one line to it.
9. `app/(auth)/layout.tsx` — all 9 lines. Centred `<main>` with `bg-muted/40`. `/register` lands inside the `(auth)` group and inherits this for free — **no new layout file**.
10. `middleware.ts` — lines 14–33. **Line 14** defines `isLogin`; **line 29** redirects a signed-in user away from it. `/register` needs the same treatment (task 11). Lines 18–25 are the unauthenticated branch: it only redirects `/agent` and `/portal` traffic, so `/register` already falls through to `NextResponse.next()` for a logged-out visitor — **verify this before editing, and do not add `/register` to the unauthenticated branch**. **Line 37**'s matcher `"/((?!api|_next/static|_next/image|favicon.ico).*)"` **excludes `/api/**`**, which is why `app/api/register/route.ts` is public with no further action.
11. `app/api/admin/users/route.ts` — all 51 lines, especially `POST` (lines 20–50): `readJson` → `safeParse` → `validationError` → `hashPassword` → `prisma.user.create` → `P2002` mapped to a `409` with `fieldErrors.email`. Task 6 follows this order exactly, minus the `requireAdmin()` guard.
12. `lib/api/http.ts` — lines 26–45. `validationError` (which calls `z.flattenError`) and `readJson`. Task 6 uses both. **Do not add a guard helper to this file** — `/api/register` is public.
13. `lib/password.ts` — all 11 lines. `hashPassword` at 10 salt rounds. Use it; do not call `bcrypt` directly outside `prisma/seed.ts`.
14. `auth.ts` — lines 18–36. `authorize` looks the user up by the **already-lowercased** email from `loginSchema`, verifies the hash, and rejects any `role` outside `ROLES` via `isRole` (line 28). A freshly registered `CUSTOMER` satisfies all three, which is what makes the auto sign-in in task 7 work.
15. `prisma/seed.ts` — lines 22–31 (the `customer@crm.local` upsert), lines 44–74 (the `CUSTOMERS` array and its upsert loop), lines 76–80 (the console summary). Task 12 edits all three regions. Note the loop's `update: customer` spread at line 71 — it has no `userId` key, which is what keeps re-seeding from clobbering a link.
16. `app/portal/layout.tsx` — line 11: `if (session.user.role !== "CUSTOMER") redirect("/agent")`. This is what a newly registered user hits after the redirect in task 7. **No edit needed** — but confirm the new role literal is `"CUSTOMER"`, not `"Customer"`.
17. `app/api/customers/route.ts` — lines 11–14. The agent list `select` does **not** include `userId`. Leave it that way; surfacing "has a portal login" in the agent UI is deferred (see the overview).
18. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — confirm the Next 16 route-handler export signature before writing task 6.
19. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — confirm that `app/(auth)/register/page.tsx` resolves to the URL `/register` (the group name is **not** in the path). The middleware edit in task 11 matches on `/register`, not `/(auth)/register`.
20. Grep for `emailField` across the repo before you start: **two** hits (`lib/validation/customer.ts:8`, `lib/validation/user.ts:10`). After task 3: **one definition** in `lib/validation/email.ts` plus imports.

---

## Product rules (from story)

| Concern | Before (Story 03) | After (Story 04) |
|---|---|---|
| Creating a `CUSTOMER` login | Seed script only — `POST /api/admin/users` refuses `role: "CUSTOMER"` | Self-service via `/register` and `POST /api/register` |
| `Customer` ↔ `User` relationship | None. An implicit, unenforced email match | **`Customer.userId`** — nullable, `@unique`, a real FK |
| Registering with an email that a `User` already has | — | **Rejected**, `409`, `fieldErrors.email` |
| Registering with an email an **unlinked** `Customer` has | — | `User` created, that `Customer` row **claimed** (`userId` set) |
| Registering with a brand-new email | — | `User` **and** `Customer` created in one `$transaction` |
| Registering with an email a **linked** `Customer` has | — | **Rejected**, `409` (defensive; see Edge Cases) |
| After successful registration | — | Signed in as `CUSTOMER`, redirected to `/portal` |
| Signed-in user visiting `/register` | Page would render | Redirected to `homeForRole(role)`, same as `/login` |
| Seeded `customer@crm.local` | A `User` with no `Customer` row | A `User` linked to a `Customer` row |

**Additive only.** No existing `AGENT`, `ADMIN`, or `CUSTOMER` path changes behaviour. Every `Customer` row that exists today keeps `userId = NULL` and keeps working exactly as it does now.

---

## Backend Tasks

### 1 — `prisma/schema.prisma`: the explicit link

**File: `prisma/schema.prisma`** — edit the `User` model (lines 13–21) and the `Customer` model (lines 25–38).

Add the back-reference to `User`, after `updatedAt` (line 20):

```prisma
  /// Set when this login was created through `/register`, or linked to an
  /// agent-created profile at registration time. Staff logins have none.
  customer     Customer?
```

Add the owning side to `Customer`, after `updatedAt` (line 33) and **above** the existing `TODO(Story 03)` comment:

```prisma
  /// The portal login that owns this profile. **Nullable on purpose**: an
  /// agent-created customer who never registered has no login, and that is a
  /// permanent, valid state — not a migration gap. `@unique` makes the
  /// relation one-to-one, so two logins can never claim the same profile.
  userId    String?  @unique
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
```

- **`onDelete: SetNull` is written explicitly** even though it is Prisma's default for an optional relation. Deleting a `User` must orphan the profile, **never** cascade-delete customer data.
- **Do not** make `userId` required and **do not** drop the `?` from `Customer?` on `User`. Both would make the seeded `nadia@northwind.example` row unrepresentable.
- Leave the `TODO(Story 03)` comment at lines 35–37 in place.

---

### 2 — The migration

Run in the repo root:

```bash
npx prisma migrate dev --name add_customer_user_link
```

- **Read the generated SQL before committing it.** SQLite cannot add a foreign-key column with `ALTER TABLE`, so Prisma emits a **table redefinition**: `CREATE TABLE "new_Customer"`, `INSERT INTO "new_Customer" SELECT … FROM "Customer"`, `DROP TABLE "Customer"`, `ALTER TABLE "new_Customer" RENAME TO "Customer"`, then re-creates `Customer_email_key` and adds `Customer_userId_key`. That is expected and preserves rows — do not hand-edit it into a plain `ALTER TABLE`.
- Confirm the file lands as `prisma/migrations/<timestamp>_add_customer_user_link/migration.sql` and that **both** unique indexes (`Customer_email_key` and `Customer_userId_key`) exist at the end of it.
- `npx prisma generate` runs as part of `migrate dev`; the `postinstall` script covers a fresh clone.

---

### 3 — `lib/validation/email.ts`: one `emailField`, not three

**Create file: `lib/validation/email.ts`**

```ts
import { z } from "zod"

/**
 * Trim and lowercase *before* the format check. `User.email` and
 * `Customer.email` are both `@unique` and SQLite compares text
 * case-sensitively, so normalisation has to happen here — not in a route
 * handler, and not in a form.
 */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
```

**File: `lib/validation/customer.ts`** — delete the local `emailField` (lines 3–12) and import it instead:

```ts
import { z } from "zod"

import { emailField } from "@/lib/validation/email"
```

**File: `lib/validation/user.ts`** — delete the local `emailField` (lines 5–14) and add the same import.

- **Pure refactor: zero behaviour change.** The two deleted definitions are byte-identical apart from their doc comments. `createCustomerSchema` and `createUserSchema` keep their exact shapes and error strings.
- This is the same reasoning Story 03 applied when it extracted `ApiError` into `lib/api/client.ts`. A third copy is where a shared rule quietly stops being shared.
- **`lib/validation/auth.ts` is deliberately left alone.** `loginSchema` is on the sign-in hot path; changing its validator in a registration story mixes two concerns. Note it as a follow-up, do not do it here.

---

### 4 — `lib/validation/register.ts`

**Create file: `lib/validation/register.ts`**

```ts
import { z } from "zod"

import { emailField } from "@/lib/validation/email"

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  email: emailField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password must be 200 characters or fewer."),
})

export type RegisterInput = z.infer<typeof registerSchema>
```

- Field rules and messages match `createUserSchema` (`lib/validation/user.ts:19–31`) exactly, minus `role` — a self-registration is **always** `CUSTOMER`, and the role must never be readable from the request body.
- **No `confirmPassword`.** Not in the acceptance criteria; do not add it.

---

### 5 — `lib/registration.ts`: the one transactional rule

**Create file: `lib/registration.ts`**

This module is the **single implementation** of the match-then-link-or-create rule. Both the route handler (task 6) and the server action (task 7) call it. Neither reimplements any part of it.

```ts
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import type { RegisterInput } from "@/lib/validation/register"

export type RegisterFailure = "email-taken" | "customer-claimed"

export type RegisterResult =
  | { ok: true; userId: string; customerId: string; linked: boolean }
  | { ok: false; reason: RegisterFailure }

/** User-facing text for each failure. Shared by the route and the server action. */
export const REGISTER_ERRORS: Record<RegisterFailure, string> = {
  "email-taken": "An account with this email already exists. Sign in instead.",
  "customer-claimed": "This email is already linked to another account.",
}

/** Thrown inside the transaction so a conflict rolls the new `User` back. */
class RegistrationConflict extends Error {
  constructor(readonly reason: RegisterFailure) {
    super(reason)
    this.name = "RegistrationConflict"
  }
}

/**
 * Creates a CUSTOMER login and attaches it to a `Customer` profile — claiming
 * an existing unlinked one when the email matches, otherwise creating a new
 * one. Both writes happen in a single `$transaction`, so a half-registered
 * user (a `User` with no profile) is not a reachable state.
 *
 * KNOWN, ACCEPTED RISK: there is no email verification (out of scope for this
 * story — no email infrastructure exists). Anyone who knows an agent-created
 * customer's email address can claim that profile. Verification, or an
 * agent-controlled "allow portal signup" flag on `Customer`, is the fix.
 *
 * `email` must already be normalised by `registerSchema` — every comparison
 * below is an exact match. SQLite has no `mode: "insensitive"` (the generated
 * client has no `QueryMode`), so case-insensitivity comes from the schema
 * lowercasing on the way in, and from nothing else.
 */
export async function registerCustomer(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, password } = input

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) return { ok: false, reason: "email-taken" }

  const passwordHash = await hashPassword(password)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "CUSTOMER" },
        select: { id: true },
      })

      const existingCustomer = await tx.customer.findUnique({
        where: { email },
        select: { id: true, userId: true },
      })

      if (existingCustomer?.userId) throw new RegistrationConflict("customer-claimed")

      if (existingCustomer) {
        await tx.customer.update({
          where: { id: existingCustomer.id },
          data: { userId: user.id },
        })
        return { ok: true as const, userId: user.id, customerId: existingCustomer.id, linked: true }
      }

      const customer = await tx.customer.create({
        // `phone` is required by the schema but not collected at registration.
        // Empty string, matching how `notes` defaults. The agent fills it in later.
        data: { name, email, phone: "", userId: user.id },
        select: { id: true },
      })
      return { ok: true as const, userId: user.id, customerId: customer.id, linked: false }
    })
  } catch (error) {
    if (error instanceof RegistrationConflict) return { ok: false, reason: error.reason }
    // Two concurrent registrations for the same email: the `findUnique` above
    // passed for both, and the loser trips `User_email_key`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "email-taken" }
    }
    throw error
  }
}
```

- **`hashPassword` is called outside the transaction on purpose.** bcrypt at 10 rounds takes ~100 ms; holding a SQLite write transaction open for that long serialises every other writer.
- **The `RegistrationConflict` throw is the rollback mechanism.** Returning a failure object from inside the callback would commit the orphaned `User`. Do not "simplify" the throw into a return.
- **`role: "CUSTOMER"` is a literal here.** It never comes from `input`; `registerSchema` has no `role` field precisely so that it cannot.
- **Do not import this module from a client component.** It reaches Prisma and bcrypt; it is server-only.

---

### 6 — `app/api/register/route.ts`

**Create file: `app/api/register/route.ts`**

```ts
import { readJson, validationError } from "@/lib/api/http"
import { REGISTER_ERRORS, registerCustomer } from "@/lib/registration"
import { registerSchema } from "@/lib/validation/register"

/**
 * **Public on purpose** — no `requireAgent()` / `requireAdmin()`. `middleware.ts`
 * excludes `/api/**` from its matcher (line 37), so nothing else guards this
 * route either. That is the intended design, not an oversight.
 */
export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = registerSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const result = await registerCustomer(parsed.data)

  if (!result.ok) {
    return Response.json(
      {
        error: "Validation failed",
        fieldErrors: { email: [REGISTER_ERRORS[result.reason]] },
      },
      { status: 409 },
    )
  }

  return Response.json(
    { userId: result.userId, customerId: result.customerId, linked: result.linked },
    { status: 201 },
  )
}
```

- The `409` body shape (`error` + `fieldErrors`) is identical to `app/api/customers/route.ts:38–44` and `app/api/admin/users/route.ts:41–47`, so `lib/api/client.ts`'s `request<T>()` surfaces it as an `ApiError` with populated `fieldErrors` without any change.
- **Never return `passwordHash`, and never return the whole `User`.** The response is three scalar fields.
- **No `GET`.** Anything not exported is a `405` from Next; do not add a handler to say so.

---

### 7 — `app/(auth)/register/actions.ts`

**Create file: `app/(auth)/register/actions.ts`**

```ts
"use server"

import { AuthError } from "next-auth"
import { z } from "zod"

import { signIn } from "@/auth"
import { REGISTER_ERRORS, registerCustomer } from "@/lib/registration"
import { registerSchema } from "@/lib/validation/register"

export type RegisterState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const result = await registerCustomer(parsed.data)
  if (!result.ok) {
    return { fieldErrors: { email: [REGISTER_ERRORS[result.reason]] } }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/portal",
    })
  } catch (error) {
    // `signIn` with `redirectTo` signals success by throwing NEXT_REDIRECT.
    // Only `AuthError` may be swallowed; everything else MUST be rethrown or
    // the user is left signed in, staring at the register form.
    if (error instanceof AuthError) {
      return { error: "Your account was created. Please sign in." }
    }
    throw error
  }

  return {}
}
```

- **The `throw error` on the last line of the `catch` is the most important line in this file.** It mirrors `app/(auth)/login/actions.ts:33`. A bare `catch {}` here breaks the redirect silently and the bug looks like "registration does nothing".
- **This action calls `registerCustomer` directly — it does not `fetch("/api/register")`.** A server action HTTP-calling its own app would drop the session cookie, double the latency, and add a failure mode for nothing. The route and the action are two entry points over one function, which is what keeps their behaviour identical.
- `redirectTo: "/portal"` rather than `"/"`. Registration always produces a `CUSTOMER`, so the extra `homeForRole` bounce through `app/page.tsx` buys nothing.

---

## Frontend Tasks

### 8 — `app/(auth)/register/register-form.tsx`

**Create file: `app/(auth)/register/register-form.tsx`**

Copy `app/(auth)/login/login-form.tsx` and change three things: a `name` field, per-field error paragraphs, and the button labels.

```tsx
"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerAction, type RegisterState } from "./actions"

const initialState: RegisterState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  )
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const fieldErrors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      {/* email: type="email", autoComplete="email", same error block */}
      {/* password: type="password", autoComplete="new-password", same error block */}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}
```

- **Uncontrolled inputs with `name=`, driven by `useActionState`** — the same idiom as `login-form.tsx`. Do **not** import `useMutation` / `@tanstack/react-query` here; that is the *agent-area* idiom (`components/agent/admin/user-form.tsx`), and the `(auth)` group is not wrapped in `Providers`.
- `aria-invalid` and the `role="alert"` paragraph match `components/agent/admin/user-form.tsx:70–76`, so the destructive-ring styling in `components/ui/input.tsx` applies with no new CSS.
- `autoComplete="new-password"` on the password field, **not** `"current-password"` — that is the one autocomplete difference from the login form.

---

### 9 — `app/(auth)/register/page.tsx`

**Create file: `app/(auth)/register/page.tsx`**

```tsx
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RegisterForm } from "./register-form"

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Register for the customer portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- Same `w-full max-w-sm` `Card` as `app/(auth)/login/page.tsx:6`. **No new layout file** — `app/(auth)/layout.tsx` already centres it.

---

### 10 — `app/(auth)/login/page.tsx`: the way in

**File: `app/(auth)/login/page.tsx`** — add the `Link` import and a footer inside `CardContent` (lines 11–13).

```tsx
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-sm text-muted-foreground">
          New customer?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </CardContent>
```

- A public page nothing links to is a page nobody finds. This is the only edit to the login page — **do not touch `LoginForm` or `loginAction`.**

---

### 11 — `middleware.ts`: `/register` is an auth page too

**File: `middleware.ts`** — edit line 14 and line 29.

```ts
  const isAuthPage = path === "/login" || path === "/register"
```

```ts
  if (isAuthPage) return NextResponse.redirect(new URL(home, nextUrl))
```

- Rename the local `isLogin` to `isAuthPage` and update its one use at line 29. Nothing else in the file references it.
- **Do not touch the unauthenticated branch (lines 18–25).** It redirects only `/agent` and `/portal` traffic; `/register` correctly falls through to `NextResponse.next()`. Adding `/register` there would make the page unreachable — the exact bug this story ships to avoid.
- Lines 30–31 (the staff and portal guards) are unchanged.

---

## Data Tasks

### 12 — `prisma/seed.ts`: the seeded login gets a real profile

**File: `prisma/seed.ts`** — three edits.

**(a)** Capture the result of the `customer@crm.local` upsert (lines 22–31):

```ts
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", passwordHash, role: "CUSTOMER" },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      passwordHash,
      role: "CUSTOMER",
    },
  })
```

**(b)** Immediately after it, add the linked profile:

```ts
  // The seeded portal login gets a real linked profile via `Customer.userId` —
  // the same shape `registerCustomer` produces. No code path special-cases the
  // seed, so anything that works here works for a real registration.
  await prisma.customer.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", phone: "+1 555 0110", userId: customerUser.id },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      phone: "+1 555 0110",
      userId: customerUser.id,
    },
  })
```

**(c)** Extend the console summary (lines 76–80) with one line:

```ts
  console.log(`Seeded ${CUSTOMERS.length} customers (unlinked) + 1 linked to customer@crm.local.`)
```

- **The three `CUSTOMERS` rows stay unlinked (`userId = NULL`) on purpose.** They are the fixtures for the match-then-link path — Test Plan item 5 registers as `nadia@northwind.example`.
- **Do not add `userId` to the `CUSTOMERS` array or to the loop's `update` at line 71.** That spread has no `userId` key, which is exactly why re-running the seed after a test registration leaves the new link intact.
- Keep `new PrismaClient()` at line 4 — the seed is the one sanctioned exception to the `lib/prisma.ts` singleton rule.

---

## Edge Cases & Failure Modes

- **Email that an existing `User` holds.** Caught by the `findUnique` at the top of `registerCustomer` (`lib/registration.ts`) → `{ ok: false, reason: "email-taken" }` → `409` with `fieldErrors.email` from `app/api/register/route.ts`, rendered under the email input by task 8. Works for staff emails too: registering as `agent@crm.local` is refused.
- **Mixed-case email.** `registerSchema`'s `emailField` lowercases before every comparison, so `Nadia@Northwind.Example` claims the seeded `nadia@northwind.example` row. **SQLite has no `mode: "insensitive"`** — there is no `QueryMode` in the generated client (`grep -c QueryMode node_modules/.prisma/client/index.d.ts` → `0`). Do not attempt it; the normalisation in the schema is the whole mechanism.
- **A `Customer` row whose email is *not* lowercase.** Only reachable by a hand-edited row: `createCustomerSchema` and `prisma/seed.ts` both write lowercase. Such a row will not match and a **second** `Customer` will be created — until the `Customer_email_key` unique index rejects it as `P2002`, which surfaces as `409 "An account with this email already exists."` The message is slightly off for that case; it is not worth a branch. Fix the data.
- **Two concurrent registrations for the same email.** Both pass the pre-check, one wins the `User_email_key` index. The loser's `P2002` is mapped to `"email-taken"` in the `catch`, and its transaction rolls back — no orphaned `User`, no orphaned `Customer`.
- **A `Customer` already claimed by another login.** `existingCustomer.userId` is non-null → `RegistrationConflict("customer-claimed")` → `409 "This email is already linked to another account."` Unreachable today (both emails are `@unique`, so a matching `Customer` implies a matching `User`, which the pre-check already rejected). It stays as a guard: the day a linking UI or an email-change feature ships, this is the branch that keeps the data honest.
- **The transaction fails after `user.create` succeeds.** `prisma.$transaction`'s callback form rolls both writes back. A `User` with no `Customer` is **not a reachable state**, which is the reason acceptance criteria demanded one transaction. If you find yourself writing two awaits outside `$transaction`, stop.
- **`signIn` throws `NEXT_REDIRECT`.** That is the success signal, not an error. `app/(auth)/register/actions.ts` rethrows anything that is not an `AuthError` (mirroring `app/(auth)/login/actions.ts:33`). A bare `catch {}` swallows the redirect and the user sits on `/register` while actually signed in.
- **`signIn` genuinely fails after the account was created.** The action returns `"Your account was created. Please sign in."` and the user can proceed at `/login`. It does **not** roll the registration back — the account is valid, only the auto-login failed.
- **A signed-in user opens `/register`.** `middleware.ts` (task 11) redirects to `homeForRole(role)`. A `CUSTOMER` goes to `/portal`, staff to `/agent`.
- **A logged-out visitor opens `/register`.** Falls through `middleware.ts:18–25` to `NextResponse.next()` — the unauthenticated branch guards only `/agent` and `/portal`. Verify this rather than assuming it; it is the one behaviour task 11 can break.
- **Self-registered customers have an empty `phone`.** `lib/registration.ts` writes `phone: ""` because registration collects only name, email, and password. `components/agent/customers/customer-table.tsx` renders an empty cell; `updateCustomerSchema` is `.partial()`, so an agent can save other fields without being forced to invent a phone number. **Do not** add `@default("")` to `Customer.phone` — that would silently weaken validation for the agent-facing create form.
- **Deleting a `User` that owns a profile.** `onDelete: SetNull` clears `Customer.userId` and the profile survives with its history. No cascade, ever. There is no delete-user endpoint yet (Story 03 shipped create + list only), so this is a schema-level guarantee waiting for its caller.
- **Re-running `npm run seed` after test registrations.** The `CUSTOMERS` loop's `update` spread carries no `userId`, so an established link is preserved. The `customer@crm.local` profile is re-linked to the same `User` id every time.
- **No email verification.** Anyone who knows an agent-created customer's email can claim that profile. **Known and accepted** per the intake; recorded in the `registerCustomer` doc comment (task 5) so it is discoverable from the code, not only from this plan.
- **`emailField` extraction skipped or half-applied.** If `lib/validation/email.ts` is created but `lib/validation/user.ts` keeps its local copy, both compile and nothing warns — the duplication just persists. Test Plan item 12's grep is what catches it.

---

## Test Plan

No test runner is installed (`package.json` has no `test` script). These are **manual** checks; items 3–9 convert directly into integration tests once a runner exists.

1. **Migration applies** — `npx prisma migrate dev --name add_customer_user_link`, then `npx prisma studio` (or `sqlite3`): `Customer` has a nullable `userId` column, the three seeded customers have `NULL`, and both `Customer_email_key` and `Customer_userId_key` indexes exist.
2. **Seed** — `npm run seed`, twice. Both runs succeed. Afterwards `customer@crm.local` has a `Customer` row with a non-null `userId`, and the three `*.example` customers still have `NULL`.
3. **Register a brand-new email** — at `/register`, submit `Rita New` / `rita@example.com` / `Passw0rd!`. You land on `/portal` **already signed in**, greeted as "Welcome, Rita New". In the DB: one new `User` (role `CUSTOMER`) and one new `Customer` with `userId` pointing at it and `phone = ""`.
4. **The new profile is visible to staff** — sign in as `agent@crm.local`, open `/agent/customers`. `Rita New` appears in the list with an empty phone cell, and her detail page loads.
5. **Register against an existing unlinked customer** — register `Nadia Rahman` / `nadia@northwind.example` / `Passw0rd!`. **No second `Customer` row is created**: the existing row's `userId` is now set, and its `phone` (`+1 555 0142`), `company`, and `notes` are **unchanged**. Confirm the row count in `Customer` did not increase.
6. **Case-insensitive match** — reset (`npm run seed` on a fresh `dev.db`), then register with `TOM@Lakeside.Example`. It claims the existing `tom@lakeside.example` row. Total `Customer` rows unchanged.
7. **Duplicate email is refused** — register with `customer@crm.local`. "An account with this email already exists. Sign in instead." renders **under the email field**, no `User` is created, and you stay on `/register`.
8. **Staff email is refused** — same check with `admin@crm.local`. Same message.
9. **Field validation** — submit the form with a 5-character password → "Password must be at least 8 characters." under the password field. Submit with `not-an-email` → the browser's `type="email"` check fires first; disable it in devtools to confirm the server returns "Enter a valid email address."
10. **API with `curl`** against a running dev server:
    - `curl -i -H 'Content-Type: application/json' -d '{"name":"Api User","email":"api@example.com","password":"Passw0rd!"}' http://localhost:3000/api/register` → **`201`** with `{"userId":…,"customerId":…,"linked":false}`. **No cookie sent — this must succeed**, proving the route is public.
    - Repeat the identical command → **`409`** with `fieldErrors.email`.
    - `curl -i -H 'Content-Type: application/json' -d '{"name":"Nadia","email":"NADIA@northwind.example","password":"Passw0rd!"}' …/api/register` → `201` with **`"linked":true`**.
    - `curl -i -H 'Content-Type: application/json' -d 'not-json' …/api/register` → `400 {"error":"Request body must be valid JSON."}`
    - `curl -i -H 'Content-Type: application/json' -d '{"name":"X","email":"x@example.com","password":"Passw0rd!","role":"ADMIN"}' …/api/register` → `201`, and the created `User` has role **`CUSTOMER`**. Privilege escalation via the body must be impossible.
    - `curl -i …/api/register` (no `-d`, so a `GET`) → `405`.
    - **Grep every response body for `passwordHash`. It must never appear.**
11. **Middleware** — signed in as the user from item 3, open `/register` → redirected to `/portal`. Signed in as `agent@crm.local`, open `/register` → redirected to `/agent`. Signed out, open `/register` → **the form renders**. Signed out, open `/portal` → still redirected to `/login?callbackUrl=/portal`.
12. **Refactor gate** — `grep -rn 'toLowerCase()' --include=*.ts lib/validation/` returns **one** hit, in `lib/validation/email.ts`. (`lib/validation/auth.ts:4` is deliberately excluded from the refactor, so scope the grep to `customer.ts`, `user.ts`, `register.ts`, and `email.ts` if that fourth hit confuses the check.)
13. **Regression — Story 02** — as `agent@crm.local`, create a customer through `/agent/customers/new`, edit its notes, and submit a duplicate email to confirm the inline `409` still renders. The task 3 extraction must not have changed a single error string.
14. **Regression — Story 03** — as `admin@crm.local`, `/agent/admin/users` lists accounts (the item-3 registration now appears there as a `CUSTOMER`) and `/agent/admin/users/new` still creates an `AGENT`.

---

## Migration / Rollback

- **This story has a real schema migration.** Back up `prisma/dev.db` before running it: `cp prisma/dev.db prisma/dev.db.bak`.
- **Half-applied state — schema without migration.** `prisma/schema.prisma` edited but `migrate dev` not run: `prisma generate` produces a client with `userId`, every write to `Customer` fails at runtime with "no such column". Tasks 1 and 2 land together, always.
- **Half-applied state — migration without seed.** The columns exist and `customer@crm.local` has no linked profile. Harmless, and fixed by `npm run seed`; nothing in the app assumes a `CUSTOMER` login has a profile.
- **Half-applied state — `registerCustomer` without the transaction.** If `$transaction` is dropped "to simplify", a failure between the two writes leaves a `User` who can sign in and reach `/portal` with no profile at all. This is the single failure mode the acceptance criteria named; do not regress it.
- **Rollback.** Revert the code, then either restore `prisma/dev.db.bak` or run `npx prisma migrate resolve --rolled-back <migration-name>` and drop the column via a new migration. Any `Customer.userId` values already written become meaningless but harm nothing — the column is nullable and no pre-Story-04 code reads it. `User` rows created by registrations survive as ordinary `CUSTOMER` logins.
- **`lib/validation/email.ts` is trivially reversible** — it changes no behaviour, so it can be reverted independently of everything else.

---

## Verification Steps

1. **Migration applies:** `npx prisma migrate dev --name add_customer_user_link` in the repo root. Read the generated SQL (Test Plan item 1) before committing.
2. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors.
3. **Lint passes:** `npm run lint` in the repo root. Zero errors.
4. **Seed applies:** `npm run seed` in the repo root, twice. Both runs succeed and the summary reports the linked customer.
5. **Frontend runs:** `npm run dev`, then walk Test Plan items 3–9 and 11 at `http://localhost:3000`.
6. **Public API:** Test Plan item 10's `curl` commands against the running dev server. The unauthenticated `201` is the one that proves the route is genuinely public.
7. **Regression:** Test Plan items 13 and 14. Nothing in the Story 01, 02, or 03 surface may change behaviour.
8. **Production build:** `npm run build`. It must succeed — `middleware.ts` was edited and runs in the edge runtime, so a stray Node-only import there fails here rather than in `dev`.

---

## Done Criteria

- [ ] `Customer.userId String? @unique` with a `user User? @relation(…, onDelete: SetNull)` and a `customer Customer?` back-reference on `User`; a committed migration under `prisma/migrations/` creating `Customer_userId_key`.
- [ ] `app/(auth)/register/page.tsx` renders a public name / email / password form in the same `Card` shell as the login page, inside the existing `(auth)` layout, with no new layout file.
- [ ] `lib/validation/register.ts` exports `registerSchema` using the shared `emailField` (`.trim().toLowerCase()` before the format check), and `lib/validation/email.ts` is the **only** definition of it — `lib/validation/customer.ts` and `lib/validation/user.ts` import rather than redefine.
- [ ] `POST /api/register` is public — an unauthenticated `curl` returns `201` — and calls no guard helper.
- [ ] Registering with an email an existing `User` holds returns `409` with `fieldErrors.email` and creates nothing.
- [ ] Registering with an email an **unlinked** `Customer` holds sets that row's `userId` and creates **no** second `Customer`; the match is case-insensitive by way of schema normalisation, not a Prisma query mode.
- [ ] Registering with a new email creates the `User` (role `CUSTOMER`, hashed via `lib/password.ts`) **and** the `Customer` inside one `prisma.$transaction`.
- [ ] `role` is never read from the request body — posting `"role":"ADMIN"` still yields a `CUSTOMER`.
- [ ] On success the user is signed in via `signIn("credentials", …)` and lands on `/portal`; the `catch` around `signIn` rethrows everything that is not an `AuthError`.
- [ ] A signed-in user visiting `/register` is redirected by `middleware.ts`, and a signed-out visitor still reaches the form.
- [ ] `app/(auth)/login/page.tsx` links to `/register`, and `/register` links back to `/login`.
- [ ] `prisma/seed.ts` gives `customer@crm.local` a linked `Customer` via `Customer.userId`, with no seed-only branch anywhere in application code; the three `*.example` customers remain unlinked.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 05.**
