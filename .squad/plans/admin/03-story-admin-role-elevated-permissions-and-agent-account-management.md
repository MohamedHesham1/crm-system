# Story 03 — Admin role: elevated permissions and agent account management

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). This story edits four of its files in place: `lib/roles.ts`, `middleware.ts`, `app/agent/layout.tsx`, `components/agent/sidebar-nav.tsx`, plus `prisma/seed.ts`.
- **Story 02 completed and committed** ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), commit `fff097a`). This story consumes and extends its contracts:
  - `lib/api/http.ts` — `requireAgent`, `validationError`, `notFound`, `readJson`. `requireAdmin()` lands here, next to `requireAgent()`, and **`requireAgent()` itself changes** (task 2).
  - `lib/customers.ts` — the `ApiError` class, the `FieldErrors` type, and the private `request<T>()` helper. Task 8 extracts all three so the new users module reuses them instead of forking a second copy.
  - `components/agent/customers/customer-form.tsx` — the form idiom (client `safeParse` first, then `useMutation`, `fieldErrors[name][0]` rendered inline, `aria-invalid` on the field). Task 13 follows it exactly.
- **Versions are pinned and must not move.** Verified in `package.json`: `next@16.3.3`, `react@19.2.8`, `prisma@^6.19.3`, `@prisma/client@^6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`, `bcryptjs@^3.0.3`. The intake pins Prisma at 6.19.3 — **do not run `npm install <pkg>@latest`**.
- **No automated test framework is installed.** `package.json` scripts are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — no runner. `## Test Plan` below is manual + `curl`, matching Stories 01 and 02.
- **No new npm dependency and no new shadcn/ui component are required.** See task 13 for why the role picker is a native `<select>` rather than a `shadcn add select`.

---

## Story Goal

Add **`ADMIN`** as a third role that is a **strict superset of `AGENT`** — same agent area, same customer API, plus account management — without changing any existing `AGENT` or `CUSTOMER` behaviour.

1. **`lib/roles.ts` becomes the single source of truth** for role-to-route and role-to-staff logic via a `Record<Role, …>` config table. After this story, no file outside `lib/roles.ts` compares a role to the literal `"AGENT"`.
2. **A real routing bug is fixed.** `homeForRole()` currently returns `/portal` for anything that is not `"AGENT"` (`lib/roles.ts:10`), which would silently bounce an ADMIN into the customer portal from both `app/page.tsx:9` and `middleware.ts:27`.
3. **An `ADMIN` seed account** — `admin@crm.local`, same password as the other seeded users.
4. **An admin-only JSON API** at `app/api/admin/users/` — `GET` list, `POST` create — guarded by a new `requireAdmin()`.
5. **Two admin-only pages** under `app/agent/admin/users/` — a list table and a create form. Non-admins are **redirected to `/agent`**, not shown a 403 page.
6. **A conditional "Admin" sidebar link**, rendered only for `ADMIN`.

**Not in scope** (intake, "Out of scope"): editing or deactivating existing accounts, password reset, granular permissions beyond the flat ADMIN/AGENT split, self-service admin signup. Ticket reassignment authority is named in the intake description as belonging to **a later story** — do not build it here.

---

## Context — Read These Files First

1. `lib/roles.ts` — all 11 lines. `ROLES` (line 1), `Role` (line 2), `isRole` (lines 4–6), `homeForRole` (lines 9–11). The ternary at line 10 is the bug in Story Goal item 2. This whole file is rewritten in task 1.
2. `middleware.ts` — lines 27–31. Line 27 computes `home` from `homeForRole(user.role)`; **line 30** is the hardcoded `user.role !== "AGENT"` gate on the agent area. Line 31 (`isPortalArea && user.role !== "CUSTOMER"`) is **correct as written** and must stay — ADMIN is not a customer. Also read line 37: the matcher `"/((?!api|_next/static|_next/image|favicon.ico).*)"` **excludes `/api/**`**, so `app/api/admin/users/route.ts` gets no ambient protection.
3. `middleware.ts` — lines 1–7. Middleware imports `authConfig` (edge-safe) and `homeForRole`, **not** `@/auth`. `lib/roles.ts` must stay free of any Prisma or `next-auth` import so it remains edge-importable; task 1 keeps it a pure module.
4. `app/agent/layout.tsx` — lines 8–13. `await auth()`, redirect unauthenticated to `/login`, then the hardcoded `session.user.role !== "AGENT"` at **line 12**. Line 18 renders `<SidebarNav />` with no props; task 14 gives it one.
5. `app/portal/layout.tsx` — line 11: `if (session.user.role !== "CUSTOMER") redirect("/agent")`. **Already correct for ADMIN** and **must not be touched** — an ADMIN landing on `/portal` belongs in `/agent`.
6. `app/page.tsx` — line 9: `redirect(homeForRole(session.user.role))`. No edit needed; it inherits the task 1 fix for free.
7. `lib/api/http.ts` — all 36 lines. `requireAgent` (lines 10–15) is the exact shape `requireAdmin` copies: `401 { error: "Unauthorized" }` with no session, `403 { error: "Forbidden" }` on the wrong role, `null` on success. Note **line 13** — the `!== "AGENT"` comparison that locks ADMIN out of the customer API today.
8. `prisma/schema.prisma` — lines 10–12 and 13–21. The doc comment says roles are `"AGENT" | "CUSTOMER"` and explains why `role` is a `String`: **SQLite has no Prisma `enum`**. That is exactly why adding ADMIN needs **no migration** — only the comment changes.
9. `prisma/seed.ts` — lines 4–31 and 65–68. `new PrismaClient()` here is the one sanctioned exception to the `lib/prisma.ts` singleton rule; `SEED_PASSWORD` is `"Passw0rd!"` (line 6), hashed once at line 9 with `bcrypt.hash(SEED_PASSWORD, 10)` and reused by every `upsert`. The console summary at lines 65–68 lists the seeded logins.
10. `lib/validation/customer.ts` — lines 8–12 and 14–32. The `emailField` idiom: `.trim().toLowerCase()` **before** `.pipe(z.email(…))`, because `email` is `@unique` and SQLite compares text case-sensitively. Task 7 reuses this shape. Do **not** copy `lib/validation/auth.ts:4`'s older `.email()` chaining.
11. `lib/customers.ts` — lines 21–58. `FieldErrors`, `ApiError` (carrying `status` + `fieldErrors`), the `customerKeys` factory, and the module-private `request<T>()`. Task 8 moves `FieldErrors`, `ApiError`, and `request<T>()` into `lib/api/client.ts`; the key factory and the customer fetchers stay.
12. `components/agent/customers/customer-form.tsx` — all 162 lines, especially `handleSubmit` (lines 49–60), the `formError` derivation (lines 62–65), one field block (lines 69–83), and the submit button (lines 157–159). Task 13 is this component with different fields plus a `<select>`.
13. `components/agent/customers/customer-table.tsx` — all 53 lines. The `useQuery` + `isPending` / `isError` / empty-state ladder that task 12 mirrors.
14. `components/agent/sidebar-nav.tsx` — all 39 lines. `LINKS` is a `const` tuple at lines 8–11; the active check at line 20 special-cases `/agent` for exact match and uses `startsWith` for the rest. Task 14 changes `LINKS` from a module constant into a value derived from a prop.
15. `app/providers.tsx` — lines 17–21. `SessionProvider` wraps `QueryClientProvider`. `useSession()` **is** available in client components — task 14 deliberately does not use it; read the rationale there.
16. `app/agent/customers/[id]/page.tsx` — all 5 lines. `PageProps<"/agent/customers/[id]">` is a **global** type in Next 16 with no import, and `props.params` is a **`Promise`**. The new admin pages take no params, so they need neither.
17. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — the **Route Context Helper** section. Confirms the Next 16 route-handler signature before you write task 10.
18. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` — layout conventions. Task 11 adds a nested layout under an existing one; confirm nested layouts compose rather than replace.
19. Grep for `role === "AGENT"` and `role !== "AGENT"` across the repo before you start and again when you finish. Before: **four** hits — `lib/roles.ts:10`, `app/agent/layout.tsx:12`, `middleware.ts:30`, `lib/api/http.ts:13`. After: **zero** outside `lib/roles.ts`.

---

## Product rules (from story)

| Concern | Story 02 (current) | Story 03 (new) |
|---|---|---|
| Roles | `["AGENT", "CUSTOMER"]` | `["AGENT", "CUSTOMER", "ADMIN"]` |
| Role logic | `homeForRole()` ternary; three hardcoded `"AGENT"` comparisons at call sites | One `ROLE_CONFIG: Record<Role, { home; isStaff }>` table; `homeForRole()` and `isStaff()` both derived from it |
| ADMIN landing route | — (would misroute to `/portal`) | `/agent` |
| Agent area access | `role === "AGENT"` only | **any staff role** — AGENT **and** ADMIN |
| Customer API access | `requireAgent()` rejects everything but AGENT | `requireAgent()` accepts any staff role; AGENT behaviour unchanged |
| Portal access | `CUSTOMER` only | **unchanged** — `CUSTOMER` only |
| Account creation | Seed script only | `POST /api/admin/users` — ADMIN only, creates AGENT or ADMIN |
| Sidebar | "Dashboard", "Customers" for all staff | Adds "Admin" — **ADMIN only** |
| Non-admin hitting `/agent/admin/**` | — | `redirect("/agent")`. **Not** a 403 page |

**Broadening only.** Every existing AGENT and CUSTOMER path must behave identically after this story. If a change makes an AGENT lose access to something, it is wrong.

---

## Backend Tasks

### 1 — `lib/roles.ts`: one config table, two derived helpers

**File: `lib/roles.ts`** — replace the whole file.

```ts
export const ROLES = ["AGENT", "CUSTOMER", "ADMIN"] as const
export type Role = (typeof ROLES)[number]

/**
 * The one source of truth for per-role routing and staff status. The
 * `Record<Role, …>` annotation is load-bearing: adding a role to `ROLES`
 * without giving it a `home` and an `isStaff` value is a compile error
 * (TS2741), not a silent runtime misroute.
 */
const ROLE_CONFIG: Record<Role, { home: "/agent" | "/portal"; isStaff: boolean }> = {
  AGENT: { home: "/agent", isStaff: true },
  ADMIN: { home: "/agent", isStaff: true },
  CUSTOMER: { home: "/portal", isStaff: false },
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** Landing route for a role. Used by `/`, by middleware, and by the post-login redirect. */
export function homeForRole(role: Role): "/agent" | "/portal" {
  return ROLE_CONFIG[role].home
}

/** True for roles that belong in the agent area. ADMIN is a strict superset of AGENT. */
export function isStaff(role: Role): boolean {
  return ROLE_CONFIG[role].isStaff
}
```

- **`ROLE_CONFIG` is not exported.** Call sites go through `homeForRole()` or `isStaff()`; exporting the table invites a fourth ad-hoc role check somewhere else.
- The `home` field is typed `"/agent" | "/portal"`, not `string`, so `homeForRole`'s existing return type survives without a cast. Its signature is **unchanged** — every current caller keeps compiling.
- **Keep this module import-free.** `middleware.ts:5` imports it into the edge runtime; a single `@/lib/prisma` or `next-auth` import here breaks the build.
- `isRole` is unchanged and now accepts `"ADMIN"`, which is what lets `auth.ts:28` mint a session for the seeded admin.

---

### 2 — `lib/api/http.ts`: broaden `requireAgent`, add `requireAdmin`

**File: `lib/api/http.ts`** — edit lines 5–15, keep the rest of the file as is.

```ts
import { z, type ZodError } from "zod"

import { auth } from "@/auth"
import { isStaff } from "@/lib/roles"

/**
 * `middleware.ts` excludes `/api/**` (see its matcher at line 37), so every
 * route handler must guard itself. Returns a `Response` to send back, or
 * `null` when the caller is authenticated staff (AGENT or ADMIN).
 */
export async function requireAgent(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isStaff(session.user.role)) return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

/** Same shape as `requireAgent`, narrowed to ADMIN. Guards `/api/admin/**`. */
export async function requireAdmin(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}
```

- **The `requireAgent` change is mandatory, not cosmetic.** Left at `!== "AGENT"`, an ADMIN would load `/agent/customers` and then watch every `useQuery` fail with a `403 Forbidden` — the page renders, the data does not. ADMIN is a strict superset of AGENT; this is the line that makes that true for the API.
- `requireAdmin` compares to the literal `"ADMIN"` on purpose. `isStaff()` cannot express "admin only", and inventing an `isAdmin()` wrapper in `lib/roles.ts` would add a second place where admin authority is defined. The grep rule in the intake targets `"AGENT"` comparisons; this is not one.
- `validationError`, `notFound`, and `readJson` (lines 17–36) are untouched.

---

### 3 — `middleware.ts`: staff check instead of `"AGENT"`

**File: `middleware.ts`** — edit the import at line 5 and the guard at line 30.

```ts
import { homeForRole, isStaff } from "@/lib/roles"
```

```ts
  const home = homeForRole(user.role)

  if (isLogin) return NextResponse.redirect(new URL(home, nextUrl))
  if (isAgentArea && !isStaff(user.role)) return NextResponse.redirect(new URL(home, nextUrl))
  if (isPortalArea && user.role !== "CUSTOMER") return NextResponse.redirect(new URL(home, nextUrl))
```

- **Line 31 does not change.** ADMIN is not a customer and must keep bouncing off `/portal` — now to `/agent`, thanks to task 1.
- Line 29's signed-in bounce off `/login` also inherits the task 1 fix: an ADMIN who hits `/login` now lands on `/agent` instead of `/portal`.
- The matcher at lines 36–38 is unchanged. `/agent/admin/**` is inside `isAgentArea` (line 15 uses `path.startsWith("/agent/")`), so middleware gets an authenticated staff user there; the **admin-only** narrowing happens in task 11, not here. Do not add an `/agent/admin` branch to middleware — it would duplicate the layout guard in a second place.

---

### 4 — `app/agent/layout.tsx`: staff guard

**File: `app/agent/layout.tsx`** — edit the import block and line 12.

```ts
import { isStaff } from "@/lib/roles"
```

```tsx
  if (!session?.user) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/portal")
```

Line 18 also changes in task 14 (`<SidebarNav role={session.user.role} />`); do both edits in one pass over this file.

---

### 5 — `prisma/schema.prisma`: comment only, **no migration**

**File: `prisma/schema.prisma`** — edit the doc comment at lines 10–12.

```prisma
/// Application roles are "AGENT" | "CUSTOMER" | "ADMIN".
/// SQLite does not support Prisma `enum` blocks, so `role` is a String
/// constrained in application code by `Role` in `lib/roles.ts`.
model User {
```

- **Do not run `prisma migrate dev`.** `role` is already `String` (line 18); the set of legal values lives in TypeScript, not in the database. There is no schema delta, so `migrate dev` would either produce an empty migration or, worse, a drift-repair diff. `prisma/migrations/` gains **no** new directory in this story.
- `npx prisma generate` is likewise unnecessary — the generated client is unchanged.

---

### 6 — Seed an `ADMIN` account

**File: `prisma/seed.ts`** — insert a third `upsert` after the `customer@crm.local` block (ends line 31), and extend the summary at lines 65–68.

```ts
  await prisma.user.upsert({
    where: { email: "admin@crm.local" },
    update: { name: "Adam Admin", passwordHash, role: "ADMIN" },
    create: {
      name: "Adam Admin",
      email: "admin@crm.local",
      passwordHash,
      role: "ADMIN",
    },
  })
```

```ts
  console.log("Seeded users:")
  console.log(`  agent@crm.local    / ${SEED_PASSWORD}  (AGENT)`)
  console.log(`  customer@crm.local / ${SEED_PASSWORD}  (CUSTOMER)`)
  console.log(`  admin@crm.local    / ${SEED_PASSWORD}  (ADMIN)`)
  console.log(`Seeded ${CUSTOMERS.length} customers.`)
```

- Reuse the `passwordHash` computed once at line 9. **Do not** call `bcrypt.hash` a second time.
- `upsert` keyed on `email` keeps `npm run seed` idempotent, matching the two existing user blocks.

---

### 7 — Zod schema for account creation

**Create file: `lib/validation/user.ts`**

```ts
import { z } from "zod"

import { ROLES } from "@/lib/roles"

/**
 * Same normalisation as `lib/validation/customer.ts`: trim and lowercase
 * *before* the format check, because `User.email` is `@unique` and SQLite
 * compares text case-sensitively.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

/** Only staff accounts can be created here. CUSTOMER is deliberately excluded. */
export const CREATABLE_ROLES = ROLES.filter((role) => role !== "CUSTOMER")

export const createUserSchema = z.object({
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
  role: z.enum(["AGENT", "ADMIN"], { message: "Choose AGENT or ADMIN." }),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
```

- `role` uses a **literal** `z.enum(["AGENT", "ADMIN"])` rather than deriving from `ROLES`, so the inferred `CreateUserInput["role"]` is the narrow `"AGENT" | "ADMIN"` union that the `<select>` and the Prisma write both want. `CREATABLE_ROLES` is derived from `ROLES` and exists only to drive the form's `<option>` list (task 13) — the two must list the same roles, and the manual check for that is Test Plan item 12.
- The `password` **minimum is 8**, deliberately stricter than `lib/validation/auth.ts:5`'s `min(1)`. Login must accept whatever is already in the DB; account creation sets a new credential and can demand more. The seeded `"Passw0rd!"` is 9 characters, so it remains a legal value.
- **Never** put `passwordHash` in a request schema. The client sends `password`; the route hashes it.

---

### 8 — Extract the shared fetch client

**Create file: `lib/api/client.ts`** — move `FieldErrors`, `ApiError`, and `request<T>()` out of `lib/customers.ts` (lines 21–33 and 41–58) verbatim, changing only `request`'s visibility.

```ts
export type FieldErrors = Record<string, string[] | undefined>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** Shared by every client data module. Throws `ApiError` on a non-2xx response. */
export async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: string } | null)?.error ?? "Request failed.",
      response.status,
      (payload as { fieldErrors?: FieldErrors } | null)?.fieldErrors ?? {},
    )
  }

  return payload as T
}
```

**File: `lib/customers.ts`** — delete the moved code (lines 21–33 and 41–58) and re-export instead.

```ts
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validation/customer"
import { request } from "@/lib/api/client"

export { ApiError } from "@/lib/api/client"
export type { FieldErrors } from "@/lib/api/client"
```

- The re-export is **not optional**. `components/agent/customers/customer-form.tsx:12` imports `ApiError` and `type FieldErrors` from `@/lib/customers`; re-exporting keeps that import — and any future one — compiling with no edit to Story 02's components. `ApiError` stays a single class identity, so the `instanceof` checks at `customer-form.tsx:39` and `:63` still hold.
- `CustomerListItem`, `Customer`, `customerKeys`, and the four fetchers stay in `lib/customers.ts` unchanged.
- **Two `ApiError` classes would be a silent bug**, not a style problem: `error instanceof ApiError` returns `false` across module copies, and every inline field error would degrade to a generic form error.

---

### 9 — Client data module for users

**Create file: `lib/users.ts`**

```ts
import type { CreateUserInput } from "@/lib/validation/user"
import { request } from "@/lib/api/client"
import type { Role } from "@/lib/roles"

/**
 * `createdAt` is a `Date` in Prisma but arrives as an ISO **string** —
 * `Response.json` serialises it. Do not type it as `Date`.
 */
export type UserListItem = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { users } = await request<{ users: UserListItem[] }>("/api/admin/users")
  return users
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const { user } = await request<{ user: UserListItem }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return user
}
```

- `userKeys` mirrors `customerKeys` (`lib/customers.ts:35–39`) minus `detail()` — there is no user detail route in this story. **Do not add a key you do not call.**
- `UserListItem` **has no `passwordHash` field** and never will. The explicit `select` in task 10 is what enforces that server-side; this type documents it.

---

### 10 — Admin users route: `GET` list and `POST` create

**Create file: `app/api/admin/users/route.ts`**

```ts
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { readJson, requireAdmin, validationError } from "@/lib/api/http"
import { hashPassword } from "@/lib/password"
import { createUserSchema } from "@/lib/validation/user"

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return Response.json({ users })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createUserSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { name, email, password, role } = parsed.data
  const passwordHash = await hashPassword(password)

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return Response.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { email: ["An account with this email already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
}
```

- **The explicit `select` is a security control, not an optimisation.** A bare `findMany()` or `create()` returns the full row including **`passwordHash`**, and this endpoint serialises its result straight to the client. Both queries must name their columns.
- `GET` lists **all** users including `CUSTOMER` accounts — the intake says "list all users". Task 12 shows the role in a column so the distinction is visible.
- `orderBy: { createdAt: "asc" }` puts the seeded accounts first and newly created ones at the bottom, so a create is visibly reflected in the list.
- The `409` body reuses the **same `fieldErrors` shape** as a `400`, exactly as `app/api/customers/route.ts` does, so task 13's form renders it inline under the email field with no special case.
- `hashPassword` comes from `lib/password.ts:5` (bcrypt, 10 rounds). **Do not** call `bcrypt` directly here.
- Import `prisma` from `@/lib/prisma` — **never** `new PrismaClient()` in application code.

---

## Frontend Tasks

### 11 — Admin area guard

**Create file: `app/agent/admin/layout.tsx`**

```tsx
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  // `app/agent/layout.tsx` already established there is a signed-in staff user;
  // this narrows the agent area to ADMIN. Non-admins are redirected, not 403'd.
  if (session?.user.role !== "ADMIN") redirect("/agent")

  return children
}
```

- This layout **nests inside** `app/agent/layout.tsx`, so the sidebar, the email footer, and the sign-out button all still render. Do not repeat that chrome here.
- It returns `children` unwrapped — no extra DOM node, no styling. Its only job is the guard.
- The `session?.user.role !== "ADMIN"` form also covers the null-session case, which `app/agent/layout.tsx:11` has already bounced to `/login`.
- **Redirect, not `forbidden()`.** The intake is explicit: non-admins go to `/agent`. Do not reach for Next's `forbidden()` / `unauthorized()` helpers.

---

### 12 — Users list page

**Create file: `app/agent/admin/users/page.tsx`**

```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { UserTable } from "@/components/agent/admin/user-table"

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Button asChild size="sm">
          <Link href="/agent/admin/users/new">New account</Link>
        </Button>
      </div>
      <UserTable />
    </div>
  )
}
```

**Create file: `components/agent/admin/user-table.tsx`**

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchUsers, userKeys } from "@/lib/users"

export function UserTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: userKeys.list(),
    queryFn: fetchUsers,
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading accounts…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load accounts."}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell className="text-muted-foreground">{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- This mirrors `components/agent/customers/customer-table.tsx` with **no empty state**: the signed-in admin is always in the list, so `data.length === 0` is unreachable. A branch for it would be dead code.
- Rows are **not** links. There is no user detail route in this story.

---

### 13 — Create-account form

**Create file: `app/agent/admin/users/new/page.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserForm } from "@/components/agent/admin/user-form"

export default function NewUserPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New account</CardTitle>
        <CardDescription>Create an agent or admin account.</CardDescription>
      </CardHeader>
      <CardContent>
        <UserForm />
      </CardContent>
    </Card>
  )
}
```

**Create file: `components/agent/admin/user-form.tsx`** — same structure as `components/agent/customers/customer-form.tsx`. The skeleton:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, type FieldErrors } from "@/lib/api/client"
import { createUser, userKeys } from "@/lib/users"
import { CREATABLE_ROLES, createUserSchema } from "@/lib/validation/user"

type Values = { name: string; email: string; password: string; role: string }

const INITIAL_VALUES: Values = { name: "", email: "", password: "", role: "AGENT" }

export function UserForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.list() })
      router.push("/agent/admin/users")
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = createUserSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }

    setFieldErrors({})
    mutation.mutate(parsed.data)
  }

  // Fields: name, email, password, role — each in the
  // `customer-form.tsx:69–83` block shape, then `formError`, then the
  // submit button reading "Create account" / "Creating…" while pending.
}
```

The **name** and **email** fields are `customer-form.tsx:69–100` verbatim. The **password** field:

```tsx
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange("password")}
          aria-invalid={Boolean(fieldErrors.password)}
        />
```

The **role** field, placed last:

```tsx
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={values.role}
          onChange={(event) => setValues((prev) => ({ ...prev, role: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.role)}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
        >
          {CREATABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {fieldErrors.role ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.role[0]}
          </p>
        ) : null}
      </div>
```

- **Native `<select>`, not `shadcn add select`.** Two fixed options do not justify a Radix popover, a new `components/ui/` file, and a registry fetch mid-implementation. The class string above is `components/ui/input.tsx:11` minus the `file:`, `placeholder:`, `disabled:`, and `dark:` fragments that do not apply to a `<select>`, so the control lines up with the `Input`s above it.
- `Values["role"]` is typed **`string`**, not `Role`. `event.target.value` on a `<select>` is a `string`; `createUserSchema.safeParse` narrows it, and `parsed.data` is already `CreateUserInput` by the time it reaches `mutation.mutate`. Do not cast.
- `autoComplete="new-password"` — this form creates **someone else's** account, so the browser must not offer the signed-in admin's own credentials.
- On success this redirects to the **list** (`/agent/admin/users`), unlike `customer-form.tsx:36` which pushes to a detail page — there is no user detail route. The `invalidateQueries` call still matters: `app/providers.tsx:12` sets `staleTime: 30_000`, so without it the new account would be missing from the list for up to 30 seconds.
- The `formError` derivation (`customer-form.tsx:62–65`) is copied as is — it renders a `401`/`403`/`500` message that carries no `fieldErrors`.
- Import `ApiError` and `FieldErrors` from **`@/lib/api/client`** here, not from `@/lib/customers`. The re-export in task 8 exists for Story 02's files, not as the path new code should use.

---

### 14 — Conditional "Admin" sidebar link

**File: `components/agent/sidebar-nav.tsx`** — replace the module-level `LINKS` (lines 8–11) with a prop-driven list.

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { Role } from "@/lib/roles"

const BASE_LINKS = [
  { href: "/agent", label: "Dashboard" },
  { href: "/agent/customers", label: "Customers" },
] as const

const ADMIN_LINKS = [{ href: "/agent/admin/users", label: "Admin" }] as const

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const links = role === "ADMIN" ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS

  // …map over `links` exactly as the current lines 17–37 map over `LINKS`…
}
```

**File: `app/agent/layout.tsx`** — line 18 becomes:

```tsx
        <SidebarNav role={session.user.role} />
```

- **The `role` prop comes from the server layout, not `useSession()`.** `app/agent/layout.tsx:9` already has the session; `useSession()` would add a client-side `/api/auth/session` round trip and a flash of the sidebar without the Admin link while it resolves. `SessionProvider` stays mounted for anything that genuinely needs client-side session state.
- The active-state check at line 20 is **unchanged** and already correct for the new link: `/agent` matches exactly, everything else uses `startsWith`, so `/agent/admin/users/new` keeps "Admin" highlighted.
- **This is a UI affordance, not a security boundary.** Hiding the link does not protect the route; task 11's layout guard and task 10's `requireAdmin()` do.

---

## Edge Cases & Failure Modes

- **A session issued before this story.** The JWT holds `role: "AGENT"` or `"CUSTOMER"`; both are still members of the widened `ROLES`, so nothing invalidates and no forced re-login is needed. `auth.config.ts:12–18` writes `token.role` only when `user` is present (a fresh sign-in), so the seeded ADMIN must sign in once to get an ADMIN token.
- **A `role` value in the DB that is not in `ROLES`** (hand-edited row, post-rollback data). `auth.ts:28`'s `isRole(user.role)` returns `false` and `authorize` returns `null` — the user cannot sign in. Unchanged behaviour, now with `"ADMIN"` accepted.
- **ADMIN visits `/portal`.** `middleware.ts:31` redirects to `homeForRole("ADMIN")` = `/agent`; `app/portal/layout.tsx:11` would do the same if the request ever reached it. Both paths agree only because task 1 fixed `homeForRole`.
- **AGENT visits `/agent/admin/users` directly.** Middleware lets it through (`isAgentArea` + staff), then `app/agent/admin/layout.tsx` redirects to `/agent`. **No 403 page**, per the intake.
- **AGENT calls `GET /api/admin/users` with a valid session cookie.** `requireAdmin()` returns `403 { "error": "Forbidden" }`. `/api/**` is outside the middleware matcher (`middleware.ts:37`), so this guard is the only thing standing there.
- **Duplicate email on create.** Prisma throws `PrismaClientKnownRequestError` `P2002` on `User.email` (`prisma/schema.prisma:16`); the handler converts it to `409` with `fieldErrors.email`, and the form renders it under the email input. The schema lowercases first, so `Agent@CRM.local` collides with the seeded `agent@crm.local`.
- **Malformed JSON body.** `readJson` (`lib/api/http.ts:27–36`) returns `400 { error: "Request body must be valid JSON." }` instead of letting `request.json()` throw a `500`.
- **`role: "CUSTOMER"` posted to `POST /api/admin/users`.** `createUserSchema`'s `z.enum(["AGENT", "ADMIN"])` rejects it with `400` and `fieldErrors.role`. The UI never offers it; the API refuses it anyway.
- **An admin creating an account with their own email.** Hits the `P2002` path above — a `409`, not a silent overwrite. The route uses `create`, never `upsert`.
- **A future fourth role added to `ROLES` without a `ROLE_CONFIG` entry.** `tsc` fails with **TS2741** (missing property) on the `Record<Role, …>` annotation. That compile error is the entire point of task 1; do not relax the annotation to `Partial<Record<…>>` or defeat it with an index signature.
- **Unicode and long values in `name`.** `name` is trimmed then capped at 120 characters by `createUserSchema`. SQLite `TEXT` stores any UTF-8; no extra handling needed.
- **Two `ApiError` classes.** If task 8's re-export is skipped and a second class is declared, `error instanceof ApiError` silently returns `false` at `customer-form.tsx:39` and field errors stop rendering inline. Test Plan item 11 catches this.

---

## Test Plan

No test runner is installed (`package.json` has no test script). These are **manual** checks; items 1–10 convert directly into integration tests once a runner exists.

1. **Seed** — `npm run seed`, then confirm the console lists `admin@crm.local … (ADMIN)`. Run it a second time: it must succeed (idempotent `upsert`) and not duplicate the row.
2. **ADMIN sign-in routes to `/agent`** — sign in as `admin@crm.local` / `Passw0rd!`. Land on `/agent`, **not** `/portal`. This is the Story Goal item 2 bug fix; check it before anything else.
3. **ADMIN signed in hits `/login`** — redirected to `/agent` (middleware line 29).
4. **AGENT regression** — sign in as `agent@crm.local`. `/agent` and `/agent/customers` load, the customers list populates (proves the task 2 `requireAgent` change did not break AGENT), `/portal` bounces to `/agent`, and the sidebar shows **only** Dashboard and Customers.
5. **CUSTOMER regression** — sign in as `customer@crm.local`. `/portal` loads; `/agent` and `/agent/admin/users` both bounce to `/portal`.
6. **ADMIN inherits the agent area** — as ADMIN, `/agent/customers` lists customers, a customer detail page loads, and notes save. Any `403` here means task 2 was skipped.
7. **Admin list page** — as ADMIN, the sidebar shows **Admin**; `/agent/admin/users` lists at least the three seeded accounts with their roles.
8. **Create an account** — as ADMIN, at `/agent/admin/users/new`, create `tess@crm.local` with role `AGENT`. It redirects to the list and the new row appears **immediately** (proves the `invalidateQueries` call). Sign out, sign in as `tess@crm.local`, land on `/agent`. Repeat once with role `ADMIN` and confirm that account sees the Admin link.
9. **Validation** — submit the create form empty (four inline errors), then with a 5-character password (`"Password must be at least 8 characters."`), then with `agent@crm.local` (`409` rendered under the email field as "An account with this email already exists.").
10. **API guards with `curl`**, one cookie jar per role:
    - `curl -i -b agent.txt http://localhost:3000/api/admin/users` → `403 {"error":"Forbidden"}`
    - `curl -i http://localhost:3000/api/admin/users` (no cookie) → `401 {"error":"Unauthorized"}`
    - `curl -i -b admin.txt http://localhost:3000/api/admin/users` → `200`, and **grep the body for `passwordHash` — it must not appear**
    - `curl -i -b admin.txt -H 'Content-Type: application/json' -d '{"name":"X","email":"x@crm.local","password":"Passw0rd!","role":"CUSTOMER"}' http://localhost:3000/api/admin/users` → `400` with `fieldErrors.role`
    - `curl -i -b admin.txt -H 'Content-Type: application/json' -d 'not-json' http://localhost:3000/api/admin/users` → `400 {"error":"Request body must be valid JSON."}`
11. **`ApiError` identity after the task 8 extraction** — as AGENT, submit the **customer** create form with a duplicate email. The message must still render inline under the email field, not as a generic form error. That inline rendering is what proves the re-export preserved one class identity.
12. **Role-list drift** — confirm the `<select>` offers exactly `AGENT` and `ADMIN`, matching `createUserSchema`'s `z.enum`. `CREATABLE_ROLES` derives from `ROLES` while the schema hard-codes the pair; this check catches them diverging.
13. **Grep gate** — `grep -rn 'role === "AGENT"\|role !== "AGENT"' --include=*.ts --include=*.tsx . --exclude-dir=node_modules` returns **no matches**. (Before this story it returns four.)
14. **Type gate** — temporarily add `"MANAGER"` to `ROLES` in `lib/roles.ts` and run `npx tsc --noEmit`. It must fail with **TS2741** pointing at `ROLE_CONFIG`. **Revert the edit.** This proves the `Record<Role, …>` annotation is doing its job.

---

## Migration / Rollback

- **No database migration.** `prisma/migrations/` is unchanged; `role` is already `String` (`prisma/schema.prisma:18`). If you find yourself running `prisma migrate dev`, stop — nothing changed in the schema but a `///` comment.
- **Rollback is a plain revert.** No applied migration to unwind and no data-shape change. Any `ADMIN` rows left in `dev.db` after a revert become unauthenticatable: `isRole` no longer accepts `"ADMIN"`, so `auth.ts:28` returns `null` and sign-in fails cleanly. Delete the row or re-seed.
- **Half-applied risk — task 2.** If `requireAdmin` ships but the `requireAgent` broadening does not, ADMIN accounts get a UI that renders and an API that returns `403` on every customer query. Tasks 1 and 2 must land in the same commit.
- **Half-applied risk — task 8.** If `lib/api/client.ts` is created but `lib/customers.ts` does not re-export `ApiError`, `components/agent/customers/customer-form.tsx:12` fails to compile. `npm run build` catches it; do not split the extraction across commits.

---

## Verification Steps

1. **Backend builds:** `npx tsc --noEmit` in the repo root. Zero errors.
2. **Lint passes:** `npm run lint` in the repo root. Zero errors.
3. **Seed applies:** `npm run seed` in the repo root. Confirm the three-user summary.
4. **Frontend runs:** `npm run dev`, then walk Test Plan items 2–9 at `http://localhost:3000`.
5. **API guards:** Test Plan item 10's `curl` commands against the running dev server.
6. **Regression:** Test Plan items 4, 5, and 11 — AGENT, CUSTOMER, and the customer form's inline duplicate-email error. Nothing in the Story 01 or Story 02 surface may change behaviour.
7. **Production build:** `npm run build`. It must succeed; `middleware.ts` imports `@/lib/roles` into the edge runtime, and a stray Node-only import there fails here rather than in `dev`.

---

## Done Criteria

- [ ] `lib/roles.ts` exports `ROLES = ["AGENT", "CUSTOMER", "ADMIN"]` and holds a **non-exported** `ROLE_CONFIG: Record<Role, { home; isStaff }>`; `homeForRole()` and `isStaff()` both read from it and neither carries its own ternary.
- [ ] `homeForRole("ADMIN")` returns `/agent`, verified by signing in as `admin@crm.local` and landing on `/agent`.
- [ ] `app/agent/layout.tsx` and `middleware.ts` gate the agent area with `isStaff()`; `middleware.ts`'s portal line still tests `!== "CUSTOMER"`; `app/portal/layout.tsx` is untouched.
- [ ] `grep -rn 'role === "AGENT"\|role !== "AGENT"'` over `.ts`/`.tsx` outside `node_modules` returns **zero** matches.
- [ ] Adding a role to `ROLES` without a `ROLE_CONFIG` entry fails `npx tsc --noEmit` with TS2741 (checked, then reverted).
- [ ] `prisma/seed.ts` upserts `admin@crm.local` / `Passw0rd!` with role `ADMIN` and the console summary lists it. **No new migration directory.**
- [ ] `requireAdmin()` exists in `lib/api/http.ts` with `requireAgent`'s shape — `401` no session, `403` wrong role, `null` otherwise.
- [ ] `requireAgent()` accepts **both** AGENT and ADMIN; an ADMIN can load `/agent/customers` and see data.
- [ ] `GET /api/admin/users` and `POST /api/admin/users` are `requireAdmin()`-guarded and Zod-validated; both queries use an explicit `select` and **no response body contains `passwordHash`**.
- [ ] `POST /api/admin/users` hashes via `hashPassword()` from `lib/password.ts`, accepts only `AGENT` or `ADMIN`, returns `201` on success and `409` with `fieldErrors.email` on a duplicate.
- [ ] `/agent/admin/users` lists all accounts with their roles; a non-admin visiting it is **redirected to `/agent`** (not shown a 403).
- [ ] `/agent/admin/users/new` creates an AGENT or ADMIN account with inline per-field errors, and the new account appears in the list immediately on redirect.
- [ ] The sidebar shows "Admin" for `ADMIN` only, driven by a `role` prop passed from `app/agent/layout.tsx` (no `useSession()` call added).
- [ ] `ApiError`, `FieldErrors`, and `request<T>()` live in `lib/api/client.ts`; `lib/customers.ts` re-exports `ApiError` and `FieldErrors` so Story 02's imports still resolve to one class identity.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 04.**
