# Story 02 — Customer profiles: model, API, and management UI

## Prerequisites

- **Story 01 completed and committed** ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`). This story consumes, and does **not** re-implement, the contracts it introduced:
  - `lib/prisma.ts` — the `prisma` singleton. **Never** construct `new PrismaClient()` in application code (`prisma/seed.ts` is the one sanctioned exception).
  - `auth.ts` — the Node-runtime `auth()` helper. Role checks in the agent area live in `app/agent/layout.tsx` (lines 9–12).
  - `app/providers.tsx` — `SessionProvider` + TanStack Query `QueryClientProvider`, mounted at `app/layout.tsx:28`. Already available to every client component; **do not add a second provider**.
  - `lib/roles.ts` — `Role`, `isRole`, `homeForRole`.
- **Versions are pinned and must not move.** Verified on disk: `next@16.3.3`, `react@19.2.8`, `prisma@6.19.3`, `@prisma/client@6.19.3`, `zod@4.4.3`, `@tanstack/react-query@5.102.4`. **Do not run `npm install <pkg>@latest`** for any of these — the intake explicitly forbids upgrading Prisma.
- **No automated test framework is installed.** Story 01 deferred it and `package.json` has no test runner. This story's intake does not ask for one either, so `## Test Plan` below is manual + `curl`. Installing Vitest remains an open follow-up; record it in `.squad/plans/customers/00-overview.md` under **Dependency notes**.
- **Story 03 (tickets) is not started.** The `Ticket` model does not exist. See task 1 for why the `Ticket[]` relation cannot be written yet.

---

## Story Goal

Ship agent-managed customer profiles on top of the Story 01 scaffold:

1. A **`Customer`** Prisma model on SQLite with a committed migration.
2. A **JSON API** under `app/api/customers/` — `GET` list, `POST` create, `GET` by id, `PATCH` by id — **agent-only**, Zod-validated, returning `400`/`401`/`403`/`404`/`409` instead of `500` on bad input.
3. Three **agent pages** under `app/agent/customers/` — list table, profile detail with an editable notes field, and a create form with client **and** server validation surfacing inline per-field errors.
4. All client data access through **TanStack Query** against the query client already mounted in `app/providers.tsx`.

**Not in scope:** file/attachment upload on notes; customer self-service editing (the `app/portal/**` area is untouched); customer deletion; pagination, search, or sorting controls (the list is a plain `ORDER BY name ASC`); the `Ticket` model and its relation.

---

## Context — Read These Files First

1. `prisma/schema.prisma` — all 21 lines. Note the `sqlite` datasource (lines 5–8) and the comment at lines 10–12 explaining why `role` is a `String`: **SQLite does not support Prisma `enum` blocks.** The same constraint shapes task 1.
2. `prisma/migrations/20260826051537_init/migration.sql` — 13 lines. The exact SQL shape `prisma migrate dev` emits for SQLite (`TEXT NOT NULL PRIMARY KEY`, `DATETIME`, a separate `CREATE UNIQUE INDEX`). Your new migration must look like this; do not hand-write it.
3. `lib/validation/auth.ts` — all 8 lines. `loginSchema` is the precedent for task 3: schema first, `z.infer` type exported alongside, `.trim().toLowerCase()` applied **before** the email format check.
4. `middleware.ts` — read lines 36–38. The matcher is `"/((?!api|_next/static|_next/image|favicon.ico).*)"`. **`/api/**` is excluded from middleware entirely.** Every route handler you write in task 5 must do its own auth; there is no ambient protection.
5. `app/agent/layout.tsx` — lines 8–13. `await auth()`, redirect unauthenticated to `/login`, redirect non-`AGENT` to `/portal`. This is the page-level guard your new pages inherit for free by living under `app/agent/`.
6. `app/providers.tsx` — lines 8–15. `staleTime: 30_000`, `refetchOnWindowFocus: false`. A 30-second stale window means a newly created customer will **not** appear in the list on navigation unless you invalidate the query key — see task 9.
7. `app/(auth)/login/login-form.tsx` — lines 22–51. The repo's form idiom: `<Label htmlFor>` + `<Input id name>`, error rendered as `<p role="alert" className="text-sm text-destructive">` (lines 43–47), disabled submit while pending. Task 10 follows this shape but drives it with `useMutation` instead of `useActionState`.
8. `components/agent/sidebar-nav.tsx` — all 31 lines. `LINKS` at line 8 currently holds a single entry; the active check at line 21 is an **exact** `pathname === link.href`. Task 8 changes both.
9. `components/ui/input.tsx` — line 11. The class string already styles `aria-invalid:border-destructive aria-invalid:ring-3`. Set `aria-invalid` on invalid fields rather than adding your own error border classes.
10. `app/api/auth/[...nextauth]/route.ts` — all 3 lines. The only existing route handler in the repo; confirms route handlers live at `app/api/<segment>/route.ts`.
11. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — the **Route Context Helper** section (lines 105–121). `params` is a **`Promise`** in Next 16 and is typed with the global `RouteContext<'/api/users/[id]'>`; no import needed.
12. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — the **Page Props Helper** section (lines 123–140). Same story for pages: `PageProps<'/blog/[slug]'>`, `await props.params`.
13. Grep for `useQuery` across `app/` and `components/` — **zero hits**. Story 01 mounted the query client but never called it. This story establishes the call-site pattern; there is no existing example to copy.

---

## Product rules (from story)

| Concern | Story 01 (current) | Story 02 (new) |
|---|---|---|
| Agent nav | Sidebar has one link, **"Dashboard"** → `/agent` | Adds **"Customers"** → `/agent/customers` |
| Data model | `User` only | Adds `Customer` |
| API surface | `/api/auth/[...nextauth]` only | Adds `/api/customers` and `/api/customers/[id]` |
| Client data fetching | Provider mounted, unused | First real `useQuery` / `useMutation` call sites |
| Customer editing | — | **Agent-managed only.** No customer self-service; `app/portal/**` is not touched. |

---

## Backend Tasks

### 1 — Prisma model `Customer`

**File: `prisma/schema.prisma`** — append after the `User` model (current file ends at line 21).

```prisma
/// Customer profiles are agent-managed. `notes` is free text (SQLite maps
/// String to TEXT; `@db.Text` is a no-op here and must not be used).
model Customer {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  phone     String
  company   String?
  notes     String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // TODO(Story 03): add `tickets Ticket[]` here together with the `Ticket`
  // model and its `customer Customer @relation(fields: [customerId], ...)`
  // back-reference. Both sides must land in the same migration.
}
```

**Do not add `tickets Ticket[]` in this story.** Verified during planning by running `npx prisma validate` against a schema containing it:

```
error: Type "Ticket" is neither a built-in type, nor refers to another model, composite type, or enum.
Error code: P1012
```

A Prisma relation field is only valid when the referenced model exists in the same schema. The intake's "just leave the relation field ready" is satisfied by the **TODO comment above** plus the note in `00-overview.md`; a literal field would break `prisma generate`, `prisma migrate`, and therefore `npm run build`.

Field decisions worth knowing:

- **`email` is `@unique`.** The intake does not state this; it is a deliberate choice matching `User.email` (`prisma/schema.prisma:16`) and it is what makes the `409` path in task 5 meaningful. It also means SQLite compares emails **case-sensitively** — task 3 lowercases every inbound email, exactly as `loginSchema` does.
- **`phone` is required**, `company` is `String?`. This mirrors the intake, which marks only `company` as optional.
- **`notes` is non-null with `@default("")`**, not `String?`. A nullable notes column forces `value ?? ""` at every textarea binding; the default keeps the profile editor in task 11 free of null handling.

Then run, from the repository root:

```bash
npx prisma migrate dev --name add_customer
```

This writes `prisma/migrations/<timestamp>_add_customer/migration.sql` (**commit it**) and regenerates the client so `prisma.customer` exists. `prisma/dev.db` stays git-ignored.

---

### 2 — Extend the seed with sample customers

**File: `prisma/seed.ts`** — inside `main()`, after the two `prisma.user.upsert` calls (lines 11–31) and **before** the `console.log` block at lines 33–35.

Use `upsert` keyed on `email`, matching the existing user seeding, so `npm run seed` stays idempotent (Story 01 `## Test Plan` item 10 depends on this):

```ts
const CUSTOMERS = [
  {
    name: "Nadia Rahman",
    email: "nadia@northwind.example",
    phone: "+1 555 0142",
    company: "Northwind Traders",
    notes: "Prefers email over phone. Renewal due in Q3.",
  },
  {
    name: "Tom Okafor",
    email: "tom@lakeside.example",
    phone: "+1 555 0188",
    company: null,
    notes: "",
  },
  {
    name: "Priya Venkat",
    email: "priya@helio.example",
    phone: "+1 555 0201",
    company: "Helio Labs",
    notes: "Escalated billing issue in March; resolved.",
  },
]

for (const customer of CUSTOMERS) {
  await prisma.customer.upsert({
    where: { email: customer.email },
    update: customer,
    create: customer,
  })
}
```

Add `console.log(\`Seeded ${CUSTOMERS.length} customers.\`)` alongside the existing credential lines. Keep every seeded email lowercase.

---

### 3 — Zod schemas for customers

**Create file: `lib/validation/customer.ts`**

```ts
import { z } from "zod"

/**
 * Trim and lowercase *before* the format check, matching `loginSchema` in
 * `lib/validation/auth.ts`. `Customer.email` is `@unique` and SQLite compares
 * text case-sensitively, so normalisation has to happen here, not in the route.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  email: emailField,
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required.")
    .max(40, "Phone must be 40 characters or fewer."),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .optional(),
  notes: z.string().max(10_000, "Notes must be 10,000 characters or fewer.").optional(),
})

/** PATCH accepts any subset. An empty object is rejected by the route, not here. */
export const updateCustomerSchema = createCustomerSchema.partial()

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
```

Two things that are **not** stylistic preferences:

- Use `z.email(...)`, not `z.string().email(...)`. The chained form in `lib/validation/auth.ts:4` still works but is **deprecated in Zod 4**. Do not "fix" `auth.ts` in this story — leave it alone.
- Use `.pipe(z.email(...))` rather than `z.email().trim().toLowerCase()`. With the latter, the format check runs **before** the transforms and `" Agent@CRM.local "` fails validation. Verified during planning: the piped form parses `"  A@B.COM "` to `"a@b.com"`.
- **No `.default("")` on `notes`.** A default makes `z.infer` (output) diverge from `z.input`, which then breaks the shared form typing in task 10. Coalesce with `?? ""` in the route instead.

---

### 4 — Shared route-handler helpers

**Create file: `lib/api/http.ts`**

```ts
import { z, type ZodError } from "zod"

import { auth } from "@/auth"

/**
 * `middleware.ts` excludes `/api/**` (see its matcher at line 37), so every
 * route handler must guard itself. Returns a `Response` to send back, or
 * `null` when the caller is an authenticated AGENT.
 */
export async function requireAgent(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "AGENT") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export function validationError<T>(error: ZodError<T>): Response {
  const { fieldErrors, formErrors } = z.flattenError(error)
  return Response.json({ error: "Validation failed", fieldErrors, formErrors }, { status: 400 })
}

export function notFound(message: string): Response {
  return Response.json({ error: message }, { status: 404 })
}

/** Reads a JSON body without letting a malformed payload become a 500. */
export async function readJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await request.json() }
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    }
  }
}
```

`validationError` is **generic over `T`** on purpose — `parsed.error` is a `ZodError<CreateCustomerInput>`, and a non-generic `ZodError` parameter would not accept it. `z.flattenError(error)` returns `{ formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }`; verified during planning against `zod@4.4.3`.

`lib/api/http.ts` imports `@/auth`, which pulls in `@/lib/prisma` — that is fine in a route handler (Node runtime) and **must never** be imported from `middleware.ts`.

---

### 5 — Collection route: `GET` list and `POST` create

**Create file: `app/api/customers/route.ts`**

```ts
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, requireAgent, validationError } from "@/lib/api/http"
import { createCustomerSchema } from "@/lib/validation/customer"

export async function GET() {
  const denied = await requireAgent()
  if (denied) return denied

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true, company: true },
  })

  return Response.json({ customers })
}

export async function POST(request: Request) {
  const denied = await requireAgent()
  if (denied) return denied

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createCustomerSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { name, email, phone, company, notes } = parsed.data

  try {
    const customer = await prisma.customer.create({
      data: { name, email, phone, company: company || null, notes: notes ?? "" },
    })
    return Response.json({ customer }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { email: ["A customer with this email already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
}
```

- `GET` takes **no parameter**. An unused `request` argument is dead weight; the list needs nothing from the request beyond the session.
- `company: company || null` — the create form posts `""` for an untouched optional field, and `""` in a nullable column is a data smell. Normalise once, here.
- The `409` body reuses the **same `fieldErrors` shape** as a `400` so the form in task 10 renders it inline under the email field with no special-casing.
- `notFound` is imported here only if you also use it; if ESLint flags it as unused, drop it from this file's import list. It is genuinely needed in task 6.

---

### 6 — Item route: `GET` by id and `PATCH`

**Create file: `app/api/customers/[id]/route.ts`**

```ts
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, requireAgent, validationError } from "@/lib/api/http"
import { updateCustomerSchema } from "@/lib/validation/customer"

export async function GET(_request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  const denied = await requireAgent()
  if (denied) return denied

  const { id } = await ctx.params

  const customer = await prisma.customer.findUnique({ where: { id } })
  if (!customer) return notFound("Customer not found.")

  return Response.json({ customer })
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/customers/[id]">) {
  const denied = await requireAgent()
  if (denied) return denied

  const { id } = await ctx.params

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = updateCustomerSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { company, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(company === undefined ? {} : { company: company || null }),
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Provide at least one field to update." }, { status: 400 })
  }

  try {
    const customer = await prisma.customer.update({ where: { id }, data })
    return Response.json({ customer })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return notFound("Customer not found.")
      if (error.code === "P2002") {
        return Response.json(
          {
            error: "Validation failed",
            fieldErrors: { email: ["A customer with this email already exists."] },
          },
          { status: 409 },
        )
      }
    }
    throw error
  }
}
```

- **`ctx.params` is a `Promise`** in Next 16 — `await` it. `RouteContext<"/api/customers/[id]">` is a **global** type generated by `next dev` / `next build` / `next typegen`; do not import it. Before the first typegen run it does not exist yet, so run `npx next typegen` after creating this file (see `## Verification Steps`).
- `_request` is prefixed with an underscore in `GET` because it is genuinely unused there but the positional slot is required.
- **`P2025`, not a pre-flight `findUnique`.** One round trip, and it closes the read-then-write race where the row is deleted between the check and the update.
- `Object.keys(data).length === 0` rejects `PATCH {}`. Zod's `.partial()` accepts an empty object happily; without this guard the endpoint silently no-ops and returns `200`, which reads as success to the caller.

---

## Frontend Tasks

### 7 — shadcn/ui primitives

From the repository root:

```bash
npx shadcn@latest add table textarea
```

Both exist in the project's configured `radix-nova` style (`components.json:3`) — verified during planning against the registry; neither has npm or registry dependencies. They land at `components/ui/table.tsx` and `components/ui/textarea.tsx`.

`table.tsx` exports `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`. `textarea.tsx` exports `Textarea`.

**Do not add `form`.** As in Story 01, `react-hook-form` is not in this project and task 10 does not need it.

---

### 8 — Sidebar link and active-state fix

**File: `components/agent/sidebar-nav.tsx`**

Replace `LINKS` (line 8):

```tsx
const LINKS = [
  { href: "/agent", label: "Dashboard" },
  { href: "/agent/customers", label: "Customers" },
] as const
```

Then fix the active check. Line 21 is `pathname === link.href`, which leaves **no** link highlighted on `/agent/customers/<id>` and `/agent/customers/new`. Inside the `.map` callback, compute:

```tsx
const isActive =
  link.href === "/agent" ? pathname === "/agent" : pathname.startsWith(link.href)
```

and use `isActive` in the `cn(...)` ternary. The `/agent` special case is **required** — a plain `startsWith` would mark "Dashboard" active on every agent page.

---

### 9 — Client API module and query keys

**Create file: `lib/customers.ts`**

```ts
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validation/customer"

export type CustomerListItem = {
  id: string
  name: string
  email: string
  phone: string
  company: string | null
}

/**
 * `createdAt` / `updatedAt` are `Date` in Prisma but arrive as ISO **strings**
 * — `Response.json` serialises them. Do not type them as `Date`.
 */
export type Customer = CustomerListItem & {
  notes: string
  createdAt: string
  updatedAt: string
}

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

export const customerKeys = {
  all: ["customers"] as const,
  list: () => [...customerKeys.all, "list"] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
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

export async function fetchCustomers(): Promise<CustomerListItem[]> {
  const { customers } = await request<{ customers: CustomerListItem[] }>("/api/customers")
  return customers
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>(`/api/customers/${id}`)
  return customer
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return customer
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return customer
}
```

The `customerKeys` factory is what makes cache invalidation reliable. `app/providers.tsx:12` sets **`staleTime: 30_000`** and **`refetchOnWindowFocus: false`**, so after a create or a notes save the cached list/detail is served unchanged for 30 seconds unless the mutation explicitly calls `queryClient.invalidateQueries({ queryKey: customerKeys.list() })`. Every mutation in tasks 10 and 11 does.

---

### 10 — Customer list page

**Create file: `app/agent/customers/page.tsx`** (Server Component — no `"use client"`)

```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CustomerTable } from "@/components/agent/customers/customer-table"

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button asChild size="sm">
          <Link href="/agent/customers/new">New customer</Link>
        </Button>
      </div>
      <CustomerTable />
    </div>
  )
}
```

**Create file: `components/agent/customers/customer-table.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerKeys, fetchCustomers } from "@/lib/customers"

export function CustomerTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: customerKeys.list(),
    queryFn: fetchCustomers,
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading customers…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load customers."}
      </p>
    )
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers yet. Create the first one.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <Link href={`/agent/customers/${customer.id}`} className="font-medium hover:underline">
                {customer.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{customer.email}</TableCell>
            <TableCell className="text-muted-foreground">{customer.phone}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

The table **must** be a client component — `useQuery` requires the React context mounted in `app/providers.tsx`. The page wrapper stays a Server Component so it keeps inheriting the `AGENT` guard in `app/agent/layout.tsx` without shipping the heading to the client.

The three columns are exactly the ones the intake names: **name, email, phone**. `company` is fetched (task 5 selects it) and shown on the detail page, not here.

---

### 11 — Create form with client + server validation

**Create file: `app/agent/customers/new/page.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerForm } from "@/components/agent/customers/customer-form"

export default function NewCustomerPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New customer</CardTitle>
        <CardDescription>Create a customer profile.</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomerForm />
      </CardContent>
    </Card>
  )
}
```

**Create file: `components/agent/customers/customer-form.tsx`** — `"use client"`.

Behaviour, in order:

1. Local `useState` for the four inputs plus `notes`, and a `fieldErrors: FieldErrors` state.
2. On submit, `event.preventDefault()`, then **client-side** `createCustomerSchema.safeParse(values)`. On failure, `setFieldErrors(z.flattenError(parsed.error).fieldErrors)` and return without a network call. This is the same schema the server runs — one source of truth, no drift.
3. On success, call the mutation:

```tsx
const queryClient = useQueryClient()
const router = useRouter()

const mutation = useMutation({
  mutationFn: createCustomer,
  onSuccess: async (customer) => {
    await queryClient.invalidateQueries({ queryKey: customerKeys.list() })
    router.push(`/agent/customers/${customer.id}`)
  },
  onError: (error) => {
    if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
  },
})
```

4. Render each field as `<Label htmlFor="name">` + `<Input id="name" name="name" aria-invalid={Boolean(fieldErrors.name)} …>` followed by:

```tsx
{fieldErrors.name ? (
  <p role="alert" className="text-sm text-destructive">
    {fieldErrors.name[0]}
  </p>
) : null}
```

`aria-invalid` alone drives the red border — `components/ui/input.tsx:11` already styles `aria-invalid:border-destructive aria-invalid:ring-3`. **Do not add error colour classes to the input.**

5. Render a **form-level** `role="alert"` paragraph for a non-field error (`mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length === 0`) so a `401`/`500` is never silent.
6. Submit button: `disabled={mutation.isPending}`, label `"Creating…"` while pending, otherwise `"Create customer"` — mirroring `SubmitButton` in `app/(auth)/login/login-form.tsx:13–20`.
7. `notes` uses `<Textarea id="notes" name="notes" rows={4}>`; `company` is a plain `<Input>` with no `required` attribute.

The duplicate-email case arrives as a `409` whose body carries `fieldErrors.email`, so step 3's `onError` renders it under the email field with **no extra code**.

**Do not set `required` on the inputs.** A native `required` short-circuits submit before the Zod pass and gives browser-chrome messages instead of the inline ones the intake asks for. (`login-form.tsx:29` does use `required`; that form has no per-field error rendering, so the trade-off there was different.)

---

### 12 — Profile detail page with editable notes

**Create file: `app/agent/customers/[id]/page.tsx`**

```tsx
import { CustomerProfile } from "@/components/agent/customers/customer-profile"

export default async function CustomerDetailPage(props: PageProps<"/agent/customers/[id]">) {
  const { id } = await props.params
  return <CustomerProfile customerId={id} />
}
```

`PageProps<...>` is global after typegen (see context item 12) — do not import it, and `await props.params`.

**Create file: `components/agent/customers/customer-profile.tsx`** — `"use client"`.

```tsx
const { data, isPending, isError, error } = useQuery({
  queryKey: customerKeys.detail(customerId),
  queryFn: () => fetchCustomer(customerId),
})
```

Then:

1. `isPending` → `"Loading customer…"`. `isError` → `role="alert"` destructive paragraph rendering `error.message` (a `404` surfaces as **"Customer not found."**, straight from the route in task 6).
2. Header block: `<h1>` with `data.name`, then `data.email`, `data.phone`, and `data.company ?? "—"` in `text-muted-foreground`. Show `Added {new Date(data.createdAt).toLocaleDateString()}` — remember `createdAt` is an ISO **string**.
3. Notes editor inside a `Card`:

```tsx
const [notes, setNotes] = useState<string | null>(null)
const value = notes ?? data.notes
const isDirty = value !== data.notes

const mutation = useMutation({
  mutationFn: (nextNotes: string) => updateCustomer(customerId, { notes: nextNotes }),
  onSuccess: async (customer) => {
    setNotes(null)
    queryClient.setQueryData(customerKeys.detail(customerId), customer)
    await queryClient.invalidateQueries({ queryKey: customerKeys.list() })
  },
})
```

The `string | null` "not yet edited" sentinel matters: initialising `useState(data.notes)` inside a component that renders **before** `data` exists is a type error, and seeding it from a `useEffect` re-introduces the stale-copy bug when the query refetches. `notes ?? data.notes` keeps the server value authoritative until the agent actually types.

4. `<Textarea rows={8} value={value} onChange={(e) => setNotes(e.target.value)} />`.
5. Save button `disabled={!isDirty || mutation.isPending}`, labelled `"Saving…"` / `"Save notes"`. A **"Discard"** ghost button next to it calls `setNotes(null)`, also `disabled={!isDirty}`.
6. After a successful save render `<p className="text-sm text-muted-foreground">Notes saved.</p>` while `mutation.isSuccess && !isDirty`; on failure a `role="alert"` destructive paragraph with `mutation.error.message`.
7. A `<Link href="/agent/customers">` "← All customers" back link above the heading.

**Only `notes` is editable in this story.** The intake asks for "profile detail with editable notes field" — name, email, phone and company are read-only here even though `PATCH` accepts them.

---

## Edge Cases & Failure Modes

- **`npx prisma migrate dev` fails with `P1012`, "Type \"Ticket\" is neither a built-in type, nor refers to another model, composite type, or enum."** Trigger: writing `tickets Ticket[]` in `Customer` before the `Ticket` model exists. Reproduced during planning. Enforced by the TODO-comment-only approach in task 1.
- **`@db.Text` on `notes` fails schema validation.** SQLite has no native `TEXT` attribute in Prisma. `String` already maps to `TEXT` in the generated SQL — compare `prisma/migrations/20260826051537_init/migration.sql:4`.
- **Any `/api/customers` endpoint is reachable while signed out or as a `CUSTOMER`.** Trigger: forgetting `requireAgent()` in a handler. `middleware.ts:37` excludes `/api` from the matcher, so there is **no fallback guard**. Enforced by the first two lines of every handler in tasks 5 and 6; verify with `grep -c requireAgent app/api/customers/route.ts` → `3` (import + two handlers), same for `app/api/customers/[id]/route.ts`.
- **`RouteContext` / `PageProps` reported as undefined types by `tsc`.** Trigger: type-checking before Next has regenerated `.next/types/routes.d.ts` — the current file lists only `"/api/auth/[...nextauth]"` as an `AppRouteHandlerRoutes` member. Fix: run `npx next typegen` (or start `next dev`) after creating the new route and page files.
- **`params` destructured synchronously.** Trigger: `function GET(req, { params }: { params: { id: string } })`. In Next 16 `params` is a `Promise`; `params.id` is `undefined` and Prisma then queries `where: { id: undefined }`. Enforced by `await ctx.params` in task 6 and `await props.params` in task 12.
- **`POST /api/customers` returns `500` on a duplicate email.** Trigger: no `P2002` catch. Expected: `409` with `fieldErrors.email` so the form renders it inline. Enforced in task 5.
- **`PATCH /api/customers/<unknown-id>` returns `500`.** Trigger: no `P2025` catch on `prisma.customer.update`. Expected: `404` `{"error":"Customer not found."}`. Enforced in task 6.
- **A non-JSON or empty request body returns `500`.** Trigger: `await request.json()` throwing `SyntaxError` outside a `try`. Expected: `400` "Request body must be valid JSON." Enforced by `readJson` in task 4.
- **`PATCH` with `{}` returns `200` and changes nothing.** Trigger: `updateCustomerSchema` is `.partial()`, so `{}` is valid. Expected: `400` "Provide at least one field to update." Enforced by the `Object.keys(data).length === 0` guard in task 6.
- **Login-style email case mismatch.** Trigger: creating `Bob@Example.com` and later `bob@example.com`. `Customer.email` is `@unique` and SQLite compares case-sensitively, so both would be stored. Handled by `.trim().toLowerCase()` in `emailField` (task 3) — which also means the second attempt correctly hits the `409`.
- **`" nadia@northwind.example "` rejected as invalid.** Trigger: `z.email().trim()` — the format check runs first. Handled by the `.pipe()` ordering in task 3.
- **A newly created customer is missing from the list for 30 seconds.** Trigger: navigating to `/agent/customers` after a create without invalidating. `app/providers.tsx:12` sets `staleTime: 30_000` and `refetchOnWindowFocus: false`, so nothing refetches on its own. Enforced by `invalidateQueries({ queryKey: customerKeys.list() })` in tasks 11 and 12.
- **Notes edits silently lost on refetch.** Trigger: seeding the textarea state from the query result via `useEffect`; a background refetch overwrites in-progress typing. Handled by the `string | null` sentinel in task 12.
- **Two agents editing the same notes.** Last write wins — `PATCH` has no version check. **Accepted for the MVP**; there is no optimistic-locking column and adding one is out of scope. Note it in `00-overview.md` so Story 03+ does not assume otherwise.
- **`company` stored as `""` instead of `NULL`.** Trigger: posting an untouched optional input. Handled by `company: company || null` in tasks 5 and 6; the detail page renders `data.company ?? "—"`.
- **`Error: Objects are not valid as a React child` / event-handler serialization error on the list page.** Trigger: `useQuery` or an `onChange` in a Server Component. Every file in tasks 10–12 that holds state or a hook starts with `"use client"`; the three `page.tsx` files deliberately do not.
- **"Dashboard" stays highlighted on `/agent/customers`.** Trigger: replacing the exact match at `components/agent/sidebar-nav.tsx:21` with a bare `pathname.startsWith(link.href)`. Handled by the `/agent` special case in task 8.
- **Unicode and emoji in `name` / `notes`.** SQLite stores UTF-8; `.max(120)` and `.max(10_000)` count **UTF-16 code units**, so a 10,000-emoji note is rejected at roughly half that many characters. Acceptable — the limit is a guard rail, not a product rule.
- **`prisma.customer` does not exist on the client type.** Trigger: editing `schema.prisma` without regenerating. `migrate dev` regenerates automatically; after a bare `git pull`, run `npx prisma generate` (the `postinstall` hook in `package.json:9` also covers a fresh `npm install`).

---

## Test Plan

**No automated test framework is installed** (see `## Prerequisites`). The checks below are `curl` probes plus manual UI passes against `npm run dev` on `http://localhost:3000`. Record pass/fail for each before calling the story done. When a runner does land, items 1–8 convert directly into integration tests over the route handlers.

**API (integration, via `curl`):**

1. **Unauthenticated list is rejected.** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/customers` → **`401`**.
2. **Unauthenticated create is rejected.** `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/customers` → **`401`** (not `400` — the guard runs before validation).
3. **Customer role is forbidden.** Sign in as `customer@crm.local` in the browser, then from DevTools → Network re-issue `GET /api/customers` (or copy the session cookie into `curl -b`). Expect **`403`** `{"error":"Forbidden"}`.

For items 4–8, sign in as `agent@crm.local` / `Passw0rd!` and run the requests from the browser DevTools console (`fetch(...)` carries the session cookie automatically), or export the cookie and pass it with `curl -b`.

4. **List returns seeded customers.** `GET /api/customers` → `200`, `customers` sorted by name ascending, each item having exactly `id`, `name`, `email`, `phone`, `company` — **no `notes`, no timestamps**.
5. **Create validation.** `POST /api/customers` with `{"name":"","email":"nope","phone":""}` → **`400`**, `fieldErrors` containing keys `name`, `email`, `phone`.
6. **Create success and normalisation.** `POST` `{"name":"Zed Ali","email":"  ZED@Ali.example ","phone":"+1 555 0999","company":""}` → **`201`**, response `customer.email` is `"zed@ali.example"` and `customer.company` is `null`.
7. **Duplicate email.** Repeat item 6 verbatim → **`409`** with `fieldErrors.email` = `["A customer with this email already exists."]`.
8. **Item route paths.** `GET /api/customers/<id>` from item 6 → `200` with `notes`, `createdAt`, `updatedAt` present as **strings**. `GET /api/customers/does-not-exist` → **`404`**. `PATCH /api/customers/<id>` with `{}` → **`400`**. `PATCH` with `{"notes":"hello"}` → `200` and `notes` is `"hello"`. `PATCH /api/customers/does-not-exist` with `{"notes":"x"}` → **`404`**. `POST /api/customers` with body `not-json` → **`400`** "Request body must be valid JSON."

**UI (manual smoke):**

9. **Nav.** As the agent, confirm the sidebar shows "Dashboard" and "Customers". Click "Customers" → `/agent/customers`, and **only** "Customers" is highlighted. Open a profile → "Customers" is still the highlighted link.
10. **List rendering.** `/agent/customers` shows a table with headers **Name / Email / Phone** and the three seeded customers in alphabetical order. Each name links to its detail page.
11. **Empty state.** With `prisma/dev.db` wiped and migrated but **not** seeded, `/agent/customers` shows "No customers yet. Create the first one." and no table.
12. **Client-side validation.** At `/agent/customers/new`, submit an empty form. Expect **no network request** in DevTools, red borders on Name / Email / Phone, and an inline message under each.
13. **Server-side validation reaches the same fields.** Fill in valid Name and Phone, enter an email that passes the client check but duplicates a seeded customer (`nadia@northwind.example`), submit. Expect a `409` in the Network tab and "A customer with this email already exists." rendered under the Email field.
14. **Create round trip.** Submit a valid new customer. Expect a redirect to `/agent/customers/<id>` showing the entered data, then a back-navigation to `/agent/customers` listing the new row **immediately** (this is the `invalidateQueries` check — a stale list here is a bug, not a timing artefact).
15. **Optional company.** Create a customer with Company left blank. Expect the detail page to show `—`, and `GET /api/customers/<id>` to report `"company": null`.
16. **Notes editing.** On a profile, confirm Save is disabled until the textarea changes. Type, click Save, expect "Notes saved."; reload the page and confirm the text persisted. Click Discard after typing and confirm the textarea reverts to the saved value and Save re-disables.
17. **404 profile.** Visit `/agent/customers/nope`. Expect the destructive `role="alert"` paragraph reading "Customer not found." — **not** a Next.js error overlay or a blank page.
18. **Role gate on the pages.** Signed in as `customer@crm.local`, visit `/agent/customers`. Expect a redirect to `/portal` (middleware first, `app/agent/layout.tsx:12` as backstop). Signed out, visit `/agent/customers/anything` → redirect to `/login?callbackUrl=%2Fagent%2Fcustomers%2Fanything`.
19. **Seed idempotency (regression on Story 01 item 10).** Run `npm run seed` twice. Both runs exit `0`, print the two credential lines plus the customer count, and no unique-constraint error appears.

---

## Migration / Rollback

- **Migration:** `npx prisma migrate dev --name add_customer` creates `prisma/migrations/<timestamp>_add_customer/migration.sql` — a `CREATE TABLE "Customer"` plus `CREATE UNIQUE INDEX "Customer_email_key"`. **Commit the migration directory.** `prisma/dev.db` remains git-ignored.
- **Additive only.** The `User` table is untouched and no existing column changes, so this migration cannot fail on existing data.
- **Half-applied state:** if `migrate dev` fails partway, `_prisma_migrations` may hold a `rolled_back` row while the `Customer` table does or does not exist. On this SQLite dev database, recover with `rm -f prisma/dev.db prisma/dev.db-journal && npx prisma migrate dev && npm run seed`. Deleting the file is safe — it holds only seeded fixtures.
- **Rollback of the story:** revert the commit, then `rm -f prisma/dev.db prisma/dev.db-journal && npx prisma migrate dev && npm run seed`. Also `rm -rf app/api/customers app/agent/customers components/agent/customers lib/api lib/customers.ts lib/validation/customer.ts components/ui/table.tsx components/ui/textarea.tsx` if the revert leaves untracked files behind. `components/agent/sidebar-nav.tsx` and `prisma/seed.ts` return to their Story 01 contents.
- **Forward note for Story 03:** adding `tickets Ticket[]` to `Customer` is a **second** migration, not an edit to this one. Never rewrite an applied migration file.

---

## Verification Steps

Run everything from the repository root, `/home/mohesham/Web Dev/crm-system`.

1. **Schema validates:** `npx prisma validate` — exits `0`. A `P1012` here means a `Ticket` relation slipped into `schema.prisma` (see task 1).
2. **Migration applies:** `npx prisma migrate dev --name add_customer` — exits `0` and creates `prisma/migrations/<timestamp>_add_customer/migration.sql`. Confirm with `grep -c 'CREATE UNIQUE INDEX "Customer_email_key"' prisma/migrations/*_add_customer/migration.sql` → `1`.
3. **Client regenerates:** `npx prisma generate` — exits `0`. Confirm the model is on the client: `node -e "const c=require('@prisma/client');console.log(Object.keys(c.Prisma.ModelName))"` prints `[ 'User', 'Customer' ]` (it prints `[ 'User' ]` today).
4. **Seed:** `npm run seed` — prints the two credential lines and the customer count, exits `0`. Run it a **second** time and confirm it still exits `0`.
5. **Route types generate:** `npx next typegen` — exits `0`. Confirm the new handlers are registered: `grep 'AppRouteHandlerRoutes =' .next/types/routes.d.ts` includes `"/api/customers"` and `"/api/customers/[id]"`, and `grep 'AppRoutes =' .next/types/routes.d.ts` includes `"/agent/customers"`, `"/agent/customers/[id]"`, and `"/agent/customers/new"`.
6. **Frontend and backend build:** `npm run build` — completes with **no TypeScript errors and no ESLint errors**. Confirm the printed route table lists `/agent/customers`, `/agent/customers/[id]`, `/agent/customers/new`, `/api/customers`, and `/api/customers/[id]`.
7. **Lint:** `npm run lint` — exits `0`.
8. **Guards are present:** `grep -c requireAgent app/api/customers/route.ts` → `3` (import + two handlers) and the same command on `app/api/customers/[id]/route.ts` → `3`. Also `grep -E "@/auth[\"']|@/lib/prisma|@/lib/api" middleware.ts` → **no matches** (the Story 01 edge-runtime constraint still holds).
9. **App runs:** `npm run dev`, then work through all 19 items in `## Test Plan`.
10. **Regression on Story 01:** sign in as both seeded users and confirm `/agent`, `/portal`, `/login`, and sign-out still behave as Story 01's `## Test Plan` describes. Nothing in this story touches auth, but `sidebar-nav.tsx` and `seed.ts` are shared files.

---

## Done Criteria

- [ ] `prisma/schema.prisma` declares `Customer` with `id`, `name`, `email` (`@unique`), `phone`, `company` (`String?`), `notes` (`String @default("")`), `createdAt`, `updatedAt` — and a `TODO(Story 03)` comment in place of the `Ticket[]` relation. `npx prisma validate` exits `0`.
- [ ] `prisma/migrations/<timestamp>_add_customer/migration.sql` exists and is committed; `prisma/dev.db` is still git-ignored.
- [ ] `prisma/seed.ts` upserts three sample customers keyed on `email`; `npm run seed` is idempotent across two consecutive runs.
- [ ] `lib/validation/customer.ts` exports `createCustomerSchema`, `updateCustomerSchema`, `CreateCustomerInput`, `UpdateCustomerInput`; emails are trimmed and lowercased **before** the format check.
- [ ] `app/api/customers/route.ts` implements `GET` (list, `name asc`) and `POST` (201). `app/api/customers/[id]/route.ts` implements `GET` and `PATCH`. Both `await ctx.params`.
- [ ] Every handler calls `requireAgent()` first: signed out → `401`, `CUSTOMER` → `403`. Verified by Test Plan items 1–3.
- [ ] Invalid bodies return `400` with a `fieldErrors` map; duplicate email returns `409` with `fieldErrors.email`; unknown id returns `404`; malformed JSON returns `400`. **No endpoint returns `500` for any Test Plan input.**
- [ ] `/agent/customers` renders a table of **Name / Email / Phone** with each name linking to the profile, plus a "New customer" button and an empty state.
- [ ] `/agent/customers/[id]` renders name, email, phone, company (`—` when null) and an editable notes textarea whose Save button is disabled until the value changes and which persists across a page reload.
- [ ] `/agent/customers/new` blocks an invalid submit **client-side** (no network request) and renders server `fieldErrors` inline under the matching fields; a successful create redirects to the new profile and the list shows the new row immediately.
- [ ] All client data access goes through `useQuery` / `useMutation` with keys from `customerKeys`; mutations invalidate `customerKeys.list()`. `grep -rn "fetch(\"/api/customers" app/ components/` returns **no matches** outside `lib/customers.ts`.
- [ ] `components/agent/sidebar-nav.tsx` has a "Customers" link that stays highlighted on `/agent/customers/**` while "Dashboard" does not.
- [ ] `npm run build` and `npm run lint` both exit `0`.
- [ ] `git diff --stat` shows **no change** to `package.json` dependency versions for `next`, `react`, `prisma`, `@prisma/client`, `zod`, or `@tanstack/react-query`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 03.**
