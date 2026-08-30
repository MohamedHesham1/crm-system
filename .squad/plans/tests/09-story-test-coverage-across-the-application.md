# Story 09 — Test coverage across the application

## Prerequisites

- **Stories 01–08 completed and committed.** This story tests them; it does not extend them.
  - Story 01 ([`../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md`](../scaffold/01-story-next-js-ts-scaffold-prisma-auth-js-base-ui-shell.md), commit `8534be4`) — `lib/prisma.ts`, `auth.ts`, `app/providers.tsx`, `lib/roles.ts`.
  - Story 02 ([`../customers/02-story-customer-profiles-model-api-and-management-ui.md`](../customers/02-story-customer-profiles-model-api-and-management-ui.md), commit `fff097a`) — `app/api/customers/route.ts`, `components/agent/customers/customer-form.tsx`.
  - Story 03 ([`../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md`](../admin/03-story-admin-role-elevated-permissions-and-agent-account-management.md), commit `ea52bab`) — `lib/api/http.ts`, `lib/api/client.ts`.
  - Story 04 ([`../registration/04-story-customer-self-registration-with-automatic-account-linking.md`](../registration/04-story-customer-self-registration-with-automatic-account-linking.md), commit `cd32c28`) — `lib/registration.ts`, `Customer.userId`.
  - Story 05 ([`../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md`](../tickets/05-story-ticket-crud-self-pickup-assignment-and-comment-thread.md), commit `ee1482f`) — the ticket routes, `lib/sla.ts`, `lib/ticket-access.ts`.
  - Story 06 ([`../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md`](../activity/06-story-audit-trail-and-in-app-notifications-for-ticket-events.md), commit `e148a5f`) — `lib/activity.ts`, `components/agent/notification-bell.tsx`.
  - Story 07 ([`../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md`](../dashboard/07-story-agent-dashboard-assigned-tickets-queue-and-faq.md), commit `4a732d1`) — `components/agent/dashboard/assigned-ticket-list.tsx`.
  - Story 08 ([`../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md`](../reports/08-story-customer-feedback-performance-reporting-and-a-management-dashboard.md), commit `e052f6e`) — `app/api/tickets/[id]/feedback/route.ts`, `Ticket.resolvedAt`.
- **Every prior story's plan closed with "still no automated test framework".** This is the story that grows it. `package.json` scripts today are `dev`, `build`, `start`, `lint`, `postinstall`, `seed` — **there is no `test` script and no test file anywhere** (`find . -name '*.test.*' -not -path './node_modules/*'` returns nothing).
- **Versions are pinned and must not move.** `next@16.3.3`, `react@19.2.8`, `react-dom@19.2.8`, `prisma@6.19.3`, `@prisma/client@6.19.3`, `zod@^4.4.3`, `@tanstack/react-query@^5.102.4`, `recharts@^3.10.1`, `radix-ui@^1.6.7`. **Do not run `npm install <pkg>@latest`** on anything already in `package.json`. Everything this story adds is a **devDependency**.
- **Node 24.19.0, npm 11.17.0** are what this is verified against. `vitest@4` requires `node ^20 || ^22 || >=24`.
- **Do not restructure application code to make it testable.** The intake forbids it. Anything genuinely untestable as written goes in `## Edge Cases & Failure Modes` as a follow-up, not into a refactor.

---

## Story Goal

Grow the repo's first automated test suite — **20 tests, all passing, runnable with `npm run test`** — over the critical paths of Stories 02–08.

1. **Vitest with two projects in one config**: a `node` project that calls Next route handlers directly against a real SQLite database, and a `jsdom` project that renders client components with React Testing Library.
2. **16 API tests** covering customers, registration/linking, ticket create-assign-status, assignment authorisation, the assignment sweep (including its rollback), audit rows, notifications, and feedback gating.
3. **4 component tests** covering the ticket status control, the customer form's validation errors, the dashboard SLA-breach badge, and the notification bell's unread count.

**The API tests are integration tests against a real database**, not mocks of Prisma. The only mocked module in them is `@/auth` — session identity is the one thing a handler cannot be given any other way. Mocking Prisma would test the mock, not the `$transaction` rollback and the `@unique` constraints this suite exists to pin down.

**Not in scope** (from the intake): Playwright or any browser/E2E test, coverage-percentage targets or a coverage reporter, pixel-precise tests of `/portal/faq` and `/agent/reports`, CI wiring, and tests for `lib/report-metrics.ts`, `lib/faq.ts`, `middleware.ts`, or the login flow.

---

## Context — Read These Files First

1. `package.json` — all 47 lines. **Lines 5–12**: the `scripts` block that gains exactly one key. **Lines 33–46**: `devDependencies`, where every package this story adds belongs. Note `"prisma": { "seed": "tsx prisma/seed.ts" }` at 12–14 — `tsx` is already installed and is **not** what runs the tests.
2. `tsconfig.json` — all 40 lines. **`"jsx": "react-jsx"`** (line 19) is why no Babel/SWC plugin is needed: Vite's transformer reads it and compiles `.tsx` with the automatic runtime. **`"paths": { "@/*": ["./*"] }`** (26–28) is the alias the Vitest config must reproduce. `"include"` covers `**/*.ts` and `**/*.tsx` (30–38), so **test files are type-checked by `npx tsc --noEmit`** — there is nothing to add there. **Do not add a `"types"` array**; it would drop the ambient `@types/node` and Next globals.
3. `lib/api/http.ts` — all 61 lines. The comment at **6–9** is the rule the whole API suite rests on: `middleware.ts` excludes `/api/**` from its matcher (`middleware.ts:37`), so **every handler guards itself** and a handler called directly from a test is the real thing, not a bypass. `requireAgent()` (11–16), `requireAdmin()` (19–24) and `requireUser()` (32–40) all call `auth()` — the single seam the tests mock.
4. `auth.ts` — all 39 lines. Exports `{ handlers, auth, signIn, signOut }` from a top-level `NextAuth({...})` call. **Importing this module in a test boots Auth.js**, which is why `@/auth` is mocked rather than configured. The mock must export all four names, not just `auth`.
5. `lib/ticket-access.ts` — all 104 lines. `resolveViewer()` (**28–53**) reads `session.user` and then `Customer.userId` — so a mocked session plus a real `Customer` row produces every `Viewer` variant, including `orphan` (52). `authorizeAssignmentChange` (**82–104**) is the table the 403/200 reassignment tests assert; read the matrix comment at 73–80 before writing them.
6. `app/api/customers/route.ts` — all 48 lines. `GET` (7–17) selects five fields and orders by `name`. `POST` (19–47) returns **201** on success and **409** (not 400) on a duplicate email (37–45). The validation-failure test targets the **400** from `validationError` at line 27.
7. `lib/validation/customer.ts` — all 29 lines. `createCustomerSchema` requires `name`, `email` and **`phone`** (12–16). A body with no `phone` is the cheapest 400. Exact message: `"Phone is required."`
8. `lib/validation/email.ts` — all 13 lines. `emailField` trims **and lowercases before** the format check. Exact message: `"Enter a valid email address."` The lowercasing is what makes the registration-linking test work with mixed-case input.
9. `lib/registration.ts` — all 93 lines. **46–50**: the pre-check that returns `email-taken`. **61–74**: the claim path — an existing `Customer` with a null `userId` is **updated**, never duplicated. **76–81**: the create path, with `phone: ""`. `REGISTER_ERRORS` (14–17) holds the exact strings; the route wraps them as `fieldErrors.email` with status **409** (`app/api/register/route.ts:19–27`).
10. `app/api/tickets/route.ts` — all 120 lines. The `POST` staff branch (70–86) requires `customerId` and honours `assignToMe` (81). The `$transaction` at **100–117** writes the ticket and its `TICKET_CREATED` audit row together.
11. `app/api/tickets/[id]/route.ts` — all 196 lines. **34–36**: a non-staff PATCH is 403. **65–83**: the `assignedAgentId` branch — `authorizeAssignmentChange` first (67–68), then the staff-account check (71–80). **85–94**: the **409** for `CLOSED → anything but CLOSED`, message `"This ticket is closed. Use the reopen action to move it back to OPEN."` **103–112**: the `resolvedAt` transition write. **136–152**: the `$transaction` that updates, audits and notifies as one unit.
12. `app/api/tickets/assign-sweep/route.ts` — all 104 lines. **15–21**: eligibility is `assignedAgentId: null`, status in `OPEN`/`IN_PROGRESS`, non-null `dueAt`, filtered by `isSlaHalfElapsed`. **43–56**: least-loaded agent, ties broken by `agent.id < best.id`. **71–101**: one `$transaction` around **all** assignments — the loop is inside it, so any throw rolls back every assignment, every audit row and every notification. That property is what the rollback test pins.
13. `lib/sla.ts` — all 76 lines. `TERMINAL_STATUSES` (**line 4**), `SLA_HOURS` (16–20: HIGH 4 h, MEDIUM 24 h, LOW 72 h), `defaultDueAt` (22–24), `isSlaBreached` (32–39), and **`isSlaHalfElapsed` (46–55)** — the sweep-eligibility rule the fixture must satisfy: `now >= createdAt + (dueAt - createdAt) / 2`.
14. `lib/activity.ts` — all 163 lines. `logActivity` (30–37) and **`notify` (45–54)**, which **drops every entry addressed to `actorId`** (line 51) — a self-claim writes no notification, so the notification test must assign to a *different* agent. `describeTicketChanges` (77–127) decides which audit rows a PATCH earns: `CLAIMED` when `before === null` and the target is the actor (115), `ASSIGNED` when it is someone else (116), `REASSIGNED` otherwise (119–122).
15. `app/api/tickets/[id]/feedback/route.ts` — all 70 lines. **21–23**: staff and orphans get 403. **30–34**: a ticket the caller does not own is a **404**. **36–41**: the non-terminal **409**, message `"You can rate this ticket once it has been resolved."` **43–45**: the already-rated 409. **56–60**: the 201 body, `{ feedback: { rating, comment, createdAt } }`.
16. `prisma/schema.prisma` — all 198 lines. `User` **13–32**, `Customer` **36–54** (`userId String? @unique` at 50), `Ticket` **59–104** (`status` default `"OPEN"` at 69, `dueAt` at 83, `resolvedAt` at 91), `Feedback` **110–127** (`ticketId @unique`, `onDelete: Cascade`), `Comment` **131–149**, `AuditLog` **152–176** (`actor` is `Restrict` — delete audit rows **before** users in any reset), `Notification` **181–198** (`user` Cascade, `relatedTicket` Cascade). These FK rules dictate the delete order in `resetDb()`.
17. `lib/prisma.ts` — all 11 lines. One `PrismaClient`, cached on `globalThis` outside production. **It reads `DATABASE_URL` from `process.env` at construction**, which is why the Vitest config must set that variable before any test module is imported — not inside a test.
18. `.env` and `.env.example` — `DATABASE_URL="file:./dev.db"`, resolved **relative to `prisma/schema.prisma`**, not to the repo root. `prisma/dev.db` is the live dev database; the suite must never touch it. `dotenv` does not override an already-set `process.env` value, so a `DATABASE_URL` injected by Vitest wins over `.env` for both the Prisma CLI and the client.
19. `.gitignore` — the `# Prisma / SQLite` block matches `/prisma/*.db`, so **`prisma/test.db` is already ignored**. No `.gitignore` change is needed.
20. `components/agent/tickets/ticket-detail.tsx` — all 227 lines. **101–118**: the status `Select` — `value={data.status}`, `disabled={isClosed || updateMutation.isPending}` (103), and `onValueChange` firing `updateMutation.mutate({ status })` (104–106). **143–153**: the "Reopen ticket" button, rendered **only** when `isClosed`. **Line 16**: `useSession()` — mock `next-auth/react`. **Lines 25–29**: `fetchUsers` is `enabled: isAdmin`, so an AGENT session issues no second query.
21. `components/agent/customers/customer-form.tsx` — all 162 lines. **49–60**: `handleSubmit` runs `createCustomerSchema.safeParse` **before** the mutation and returns early on failure — the validation test therefore asserts `createCustomer` was **never called**. Errors render as `<p role="alert">` (78–82, 95–99, 111–115). **Line 30**: `useRouter()` — mock `next/navigation`.
22. `components/agent/dashboard/assigned-ticket-list.tsx` — all 51 lines. Pure presentational, **no hooks and no providers needed**. **Line 43**: `{ticket.slaBreached ? <Badge variant="destructive">SLA breached</Badge> : null}`. **Lines 8–12**: the empty state. Only `next/link` (line 1) stands between it and a bare `render()`.
23. `components/agent/notification-bell.tsx` — all 113 lines. **17–29**: the feed query, `staleTime: 0`, `refetchInterval: 30_000`. **38**: `unreadCount`. **47–51**: the count badge, rendered only when `unreadCount > 0`. **58–72**: "Mark all read", which calls `markNotificationRead` per unread item and invalidates `notificationKeys.all` on success (33–35).
24. `lib/notifications.ts` (36 lines), `lib/customers.ts` (55 lines), `lib/tickets.ts` (136 lines) — the client modules the component tests partially mock. Each re-exports `ApiError` from `lib/api/client.ts`; **keep the real exports** via `importOriginal` so `ticketKeys` (`lib/tickets.ts:62–67`) and `notificationKeys` (`lib/notifications.ts:22–25`) stay identical to what the component uses.
25. `app/providers.tsx` — all 22 lines. `staleTime: 30_000`, `refetchOnWindowFocus: false` (line 12). **Tests must not use this component** — it also mounts `SessionProvider`, which would try to hit `/api/auth/session`. Each component test builds its own `QueryClient` with `retry: false`.
26. `components/ui/select.tsx` (192 lines) and `components/ui/popover.tsx` (89 lines) — both wrap the `radix-ui` unified package (`import { Select as SelectPrimitive } from "radix-ui"`). **Radix's pointer and measurement APIs do not exist in jsdom**; the polyfills in task 3 are what make these two components interactable at all.
27. Grep for `vitest`, `describe(` and `@testing-library` across the repo: **zero hits outside `node_modules/`**. There is no prior pattern to match — this story sets it.

---

## Implementation tasks

### 1 — Install the test toolchain

**File: `package.json`**

One command, all `--save-dev`:

```bash
npm install --save-dev vitest@^4.1.11 jsdom@^30.0.1 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.1 @testing-library/user-event@^14.6.6 @testing-library/jest-dom@^7.0.1
```

- **`@testing-library/dom` is not optional.** RTL v16 declares it as a **peer** dependency (`^10.0.0`), and `@testing-library/jest-dom@7` requires `>=10 <11`. Omitting it leaves an unmet peer and a runtime resolution failure.
- **Do not install `@vitejs/plugin-react`.** Its 6.x peer range demands `vite@^8`, while Vitest 4 resolves `vite@^6 || ^7 || ^8`, so the two can disagree. It is unnecessary anyway — `"jsx": "react-jsx"` in `tsconfig.json` is enough for Vite to transform `.tsx`.
- **Do not install `vite-tsconfig-paths`.** Task 2 declares the one alias by hand.
- **Do not install a coverage provider.** Coverage targets are out of scope.

Add exactly one script, after `"lint"`:

```json
    "test": "vitest run",
```

**`vitest run`, not bare `vitest`** — the bare form starts watch mode and never exits, which makes `npm run test` unusable in a script or a hook.

### 2 — `vitest.config.ts`: two projects, one database

**Create file: `vitest.config.ts`** (repo root)

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

/**
 * Resolved **relative to `prisma/schema.prisma`**, exactly like the
 * `DATABASE_URL` in `.env` — so this is `prisma/test.db`, never the repo root.
 * `prisma/*.db` is already gitignored. `dotenv` does not override a variable
 * that is already set, so this value wins over `.env` in both the Prisma CLI
 * (task 3) and the client (`lib/prisma.ts:7`).
 */
export const TEST_DATABASE_URL = "file:./test.db"

export default defineConfig({
  resolve: {
    // The hand-written equivalent of `tsconfig.json`'s `paths` (lines 26–28).
    alias: { "@": root },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    // One SQLite file, one writer. Parallel workers produce SQLITE_BUSY, not
    // faster tests, on a suite this size.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias: { "@": root } },
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.ts"],
          setupFiles: ["./tests/setup/api.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
      {
        resolve: {
          alias: {
            "@": root,
            // `next/link` needs an App Router context that no test mounts.
            // A plain anchor is all four component tests need from it.
            "next/link": `${root}tests/stubs/next-link.tsx`,
          },
        },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["./tests/setup/dom.ts"],
        },
      },
    ],
  },
})
```

- **`projects`, not a `vitest.workspace.ts` file** — the workspace file is removed in Vitest 4.
- **The alias is repeated per project.** A project's `resolve` replaces the root's rather than merging into it.
- **The `components` project sets no `DATABASE_URL`** and must never import `@/lib/prisma`.

### 3 — Test scaffolding

**Create file: `tests/global-setup.ts`**

```ts
import { execFileSync } from "node:child_process"

import { TEST_DATABASE_URL } from "../vitest.config"

/**
 * Runs **once**, before any worker starts. `db push --force-reset` drops and
 * recreates `prisma/test.db` from `schema.prisma` — deliberately not
 * `migrate deploy`: the suite tests the current schema, not migration history,
 * and a reset is the only way to guarantee a clean file after a crashed run.
 */
export default function setup() {
  execFileSync("npx", ["prisma", "db", "push", "--force-reset", "--skip-generate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  })
}
```

**Create file: `tests/mocks/auth.ts`**

```ts
import type { Role } from "@/lib/roles"

export type SessionUser = { id: string; name: string; email?: string; role: Role }

let current: SessionUser | null = null

/** `null` = signed out, which is what produces every 401 in the suite. */
export function signInAs(user: SessionUser | null): void {
  current = user
}

/** Stands in for `auth()` in `auth.ts:10`. */
export async function auth() {
  return current ? { user: { ...current } } : null
}

// `auth.ts` exports four names. Anything importing one of the other three from
// a mocked `@/auth` must fail loudly rather than get `undefined`.
export const handlers = {
  GET: () => {
    throw new Error("Auth handlers are not available in tests.")
  },
  POST: () => {
    throw new Error("Auth handlers are not available in tests.")
  },
}
export const signIn = () => {
  throw new Error("signIn is not available in tests.")
}
export const signOut = () => {
  throw new Error("signOut is not available in tests.")
}
```

**Create file: `tests/helpers/db.ts`**

```ts
import { prisma } from "@/lib/prisma"

/**
 * Delete order is dictated by the FK rules in `prisma/schema.prisma`:
 * `AuditLog.actor` is `Restrict` (line 168), so audit rows must go before
 * users; `Comment.author` is `Restrict` (line 141); `Ticket.customer` is
 * `Restrict` (line 72). Everything else cascades, but deleting explicitly
 * keeps the order readable and independent of cascade behaviour.
 */
export async function resetDb(): Promise<void> {
  await prisma.feedback.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
}
```

**Create file: `tests/helpers/factories.ts`**

```ts
import { prisma } from "@/lib/prisma"
import type { Role } from "@/lib/roles"
import { defaultDueAt } from "@/lib/sla"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

let seq = 0
const unique = () => `${Date.now()}-${seq++}`

/**
 * `passwordHash` is a literal, never a real bcrypt hash: nothing in this suite
 * goes through `authorize()` (`auth.ts:18–36`) — sessions come from
 * `tests/mocks/auth.ts` instead — so hashing would cost ~100 ms per user and
 * prove nothing.
 */
export function createUser(role: Role, overrides: { name?: string; email?: string } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${unique()}`,
      email: overrides.email ?? `${role.toLowerCase()}-${unique()}@test.local`,
      passwordHash: "test-hash",
      role,
    },
  })
}

export function createCustomer(overrides: { name?: string; email?: string; userId?: string } = {}) {
  return prisma.customer.create({
    data: {
      name: overrides.name ?? `Customer ${unique()}`,
      email: overrides.email ?? `customer-${unique()}@test.local`,
      phone: "+1 555 0100",
      userId: overrides.userId ?? null,
    },
  })
}

export function createTicket(input: {
  customerId: string
  status?: TicketStatus
  priority?: TicketPriority
  assignedAgentId?: string | null
  createdAt?: Date
  dueAt?: Date | null
}) {
  const priority = input.priority ?? "MEDIUM"
  return prisma.ticket.create({
    data: {
      subject: `Ticket ${unique()}`,
      description: "Fixture ticket.",
      category: "Billing",
      priority,
      status: input.status ?? "OPEN",
      customerId: input.customerId,
      assignedAgentId: input.assignedAgentId ?? null,
      createdAt: input.createdAt,
      dueAt: input.dueAt === undefined ? defaultDueAt(priority) : input.dueAt,
    },
  })
}
```

**Create file: `tests/helpers/request.ts`**

```ts
/** A `Request` with a JSON body, matching what `readJson` expects (`lib/api/http.ts:52–60`). */
export function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** The `ctx` a dynamic-segment handler awaits — `params` is a **Promise**. */
export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}
```

**Create file: `tests/setup/api.ts`**

```ts
import { afterAll, beforeEach } from "vitest"

import { prisma } from "@/lib/prisma"
import { resetDb } from "@/tests/helpers/db"
import { signInAs } from "@/tests/mocks/auth"

beforeEach(async () => {
  signInAs(null)
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

**Create file: `tests/setup/dom.ts`**

```ts
import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// `globals` is left at its default `false`, so RTL's own auto-cleanup (which
// looks for a global `afterEach`) never registers. Do it here instead.
afterEach(cleanup)

// jsdom implements none of these. Radix's Select and Popover call all of them
// during open/close, and without them `userEvent.click` on a trigger throws.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
```

**Create file: `tests/stubs/next-link.tsx`**

```tsx
import type { AnchorHTMLAttributes, ReactNode } from "react"

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }

/** Aliased over `next/link` for the `components` project (`vitest.config.ts`). */
export default function Link({ href, children, ...rest }: Props) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}
```

**Create file: `tests/helpers/render.tsx`**

```tsx
import type { ReactElement, ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"

/**
 * `app/providers.tsx` is deliberately **not** reused: it also mounts
 * `SessionProvider`, which would fetch `/api/auth/session`. `retry: false` is
 * the one setting that matters — the default three retries turn an expected
 * error state into a multi-second wait.
 */
export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) }
}
```

### 4 — API tests (16)

Every file in `tests/api/` opens with the same two lines, in this order:

```ts
vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"
```

**The factory is a bare dynamic `import()` and closes over nothing.** A factory referencing a top-level `const` from the same file hits the hoisting TDZ error; a factory that only re-exports the mock module does not, and the `signInAs` imported below is the **same module instance** the mock uses.

#### `tests/api/customers.test.ts` — 2 tests

- **`creates a customer and lists it`** — `signInAs` an AGENT; `POST` from `app/api/customers/route.ts` with a full body → **201**, `customer.id` defined. Then `GET()` → **200** and `customers` contains that email.
- **`rejects a customer with no phone`** — same session, body missing `phone` → **400**, `fieldErrors.phone` is `["Phone is required."]`, and `prisma.customer.count()` is `0`.

#### `tests/api/register.test.ts` — 3 tests

Import `POST` from `app/api/register/route.ts`. **No session** — the route is public by design (`app/api/register/route.ts:5–9`).

- **`creates a linked User and Customer for a new email`** → **201**, `linked === false`; the created `Customer.userId` equals the returned `userId`, and `prisma.customer.count()` is `1`.
- **`links to an existing unlinked customer instead of duplicating`** — pre-create a `Customer` with `email: "nadia@northwind.example"` and `userId: null`; register with `"Nadia@Northwind.example"` (mixed case, to exercise `emailField`'s lowercasing) → **201**, `linked === true`, `customerId` equals the pre-created id, and `prisma.customer.count()` is still **`1`**.
- **`rejects a duplicate email`** — pre-create a `User` with that email, then register → **409**, `fieldErrors.email` is `["An account with this email already exists. Sign in instead."]`, and `prisma.user.count()` is still `1`.

#### `tests/api/tickets.test.ts` — 4 tests

Import `POST` from `app/api/tickets/route.ts` and `PATCH` from `app/api/tickets/[id]/route.ts`.

- **`creates, claims and resolves a ticket`** — AGENT session plus a customer. `POST` with `{ subject, description, category, priority: "MEDIUM", customerId }` → **201**, `status === "OPEN"`, `assignedAgent === null`. `PATCH { assignedAgentId: <agent.id> }` → **200**, `assignedAgent.id` is the agent. `PATCH { status: "RESOLVED" }` → **200**; re-read the row and assert **`resolvedAt` is not null** (`app/api/tickets/[id]/route.ts:103–112`).
- **`refuses to move a closed ticket out of CLOSED`** — fixture ticket with `status: "CLOSED"`; `PATCH { status: "OPEN" }` → **409**, `error` is `"This ticket is closed. Use the reopen action to move it back to OPEN."`, and the stored status is still `CLOSED`.
- **`forbids a non-admin agent reassigning to another agent`** — two AGENTs, ticket **unassigned**; signed in as agent A, `PATCH { assignedAgentId: <agentB.id> }` → **403**, `error` is `"Only an admin can assign a ticket to another agent."` (`lib/ticket-access.ts:103`), and `assignedAgentId` is still `null`.
- **`allows an admin to perform the same reassignment`** — same fixture, ADMIN session → **200** and `assignedAgentId === agentB.id`.

#### `tests/api/activity.test.ts` — 2 tests

- **`writes an audit row on a status change`** — AGENT `PATCH { status: "IN_PROGRESS" }` on an `OPEN` ticket → **200**; exactly one `AuditLog` row for that `entityId` with `action: "STATUS_CHANGED"`, `actorId` the agent, and `detail` containing `"from OPEN to IN_PROGRESS"`.
- **`notifies the agent who gains a ticket`** — ADMIN assigns an unassigned ticket to AGENT B → **200**; one `Notification` with `userId === agentB.id`, `type: "TICKET_ASSIGNED"`, `relatedTicketId` the ticket, `read === false`; **no** notification for the admin. **The assignment must be to another user** — `notify()` drops self-addressed entries (`lib/activity.ts:51`).

#### `tests/api/assign-sweep.test.ts` — 3 tests

Import `POST` from `app/api/tickets/assign-sweep/route.ts`. ADMIN session in all three (`requireAdmin()` at line 12).

An **eligible** fixture, per `isSlaHalfElapsed` (`lib/sla.ts:46–55`): `createdAt` 3 hours ago, `dueAt` 1 hour from now, `status: "OPEN"`, `assignedAgentId: null`, priority `MEDIUM`. More than half the window has passed, so it qualifies; a control ticket created *now* with a 24 h `dueAt` does not.

- **`claims an eligible aging ticket for the least loaded agent`** — one AGENT, one eligible ticket, one fresh control ticket → `swept === 1`, `assignments[0].ticketId` is the aging ticket, its stored `assignedAgentId` is the agent, and the control ticket is **still unassigned**.
- **`records the same audit row and notification as a manual claim`** — same fixture → one `AuditLog` with `action: "ASSIGNED"` (the action `describeTicketChanges` also produces for an assignment to someone other than the actor, `lib/activity.ts:116`) whose `detail` contains `"assignment sweep"`, and one `Notification` for the assigned agent with `type: "TICKET_ASSIGNED"` and the right `relatedTicketId`.
- **`rolls back completely when one assignment fails`** — two eligible tickets, one AGENT. Partially mock the activity module so the **second** `notify` call throws:

  ```ts
  const { notifyCalls } = vi.hoisted(() => ({ notifyCalls: { count: 0 } }))

  vi.mock("@/lib/activity", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/activity")>()
    return {
      ...actual,
      notify: async (...args: Parameters<typeof actual.notify>) => {
        notifyCalls.count += 1
        if (notifyCalls.count === 2) throw new Error("boom")
        return actual.notify(...args)
      },
    }
  })
  ```

  `await expect(POST()).rejects.toThrow("boom")`, then assert **all** of: both tickets still have `assignedAgentId === null`, `prisma.auditLog.count()` is `0`, and `prisma.notification.count()` is `0`. This is the acceptance criterion "no orphaned audit or notification rows for assignments that never actually happened", and it holds only because the loop sits **inside** the `$transaction` (`app/api/tickets/assign-sweep/route.ts:72–100`).

#### `tests/api/feedback.test.ts` — 2 tests

Import `POST` from `app/api/tickets/[id]/feedback/route.ts`. The session is the **customer's `User`**, and the `Customer` row must carry `userId` — `resolveViewer()` resolves ownership through that column and nothing else.

- **`rejects feedback on a ticket that is not resolved`** — `status: "OPEN"`, body `{ rating: 5 }` → **409**, `error` is `"You can rate this ticket once it has been resolved."`, and `prisma.feedback.count()` is `0`.
- **`accepts feedback on a resolved ticket`** — the same ticket at `status: "RESOLVED"`, body `{ rating: 4, comment: "Quick fix." }` → **201**, `feedback.rating === 4`, and the stored row's `ticketId` matches.

### 5 — Component tests (4)

Every file in `tests/components/` imports `renderWithQuery` from `@/tests/helpers/render` and uses `userEvent.setup()`.

#### `tests/components/ticket-status-control.test.tsx` — 1 test

**`changes status through the select and locks the control when closed`**

```ts
const { fetchTicketMock, updateTicketMock, useSessionMock } = vi.hoisted(() => ({
  fetchTicketMock: vi.fn(),
  updateTicketMock: vi.fn(),
  useSessionMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }))
vi.mock("@/lib/tickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tickets")>()
  return { ...actual, fetchTicket: fetchTicketMock, updateTicket: updateTicketMock }
})
```

`useSessionMock` returns `{ data: { user: { id: "agent-1", name: "Ava", role: "AGENT" } } }` — an **AGENT**, so the `fetchUsers` query stays disabled (`ticket-detail.tsx:28`). `fetchTicketMock` resolves a full `TicketDetail` with `status: "OPEN"`, `assignedAgent: null`, `comments: []`, `feedback: null`, `slaBreached: false`.

Render `<TicketDetail ticketId="t1" />`, `await screen.findByText(<subject>)`, then:

1. `await user.click(screen.getAllByRole("combobox")[0])` — the status trigger is the **first** combobox. Select it positionally, not by accessible name: the shadcn trigger sets none.
2. `await user.click(await screen.findByRole("option", { name: "RESOLVED" }))`.
3. `expect(updateTicketMock).toHaveBeenCalledWith("t1", { status: "RESOLVED" })`.

Then `cleanup()`, point `fetchTicketMock` at a `status: "CLOSED"` ticket, render again, and assert the status trigger is **disabled** and `screen.getByRole("button", { name: "Reopen ticket" })` exists (`ticket-detail.tsx:143–153`).

**`CommentThread` mounts inside `TicketDetail`** and issues its own query; add its fetch function to the same partial mock, resolving `[]`, so no unhandled rejection appears. **Confirm the exact export name in `lib/tickets.ts` before writing the mock** — read lines 68–136.

#### `tests/components/customer-form.test.tsx` — 1 test

**`shows field errors and does not submit invalid input`**

```ts
const { push, createCustomerMock } = vi.hoisted(() => ({
  push: vi.fn(),
  createCustomerMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/customers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/customers")>()
  return { ...actual, createCustomer: createCustomerMock }
})
```

Render `<CustomerForm />`, type `"not-an-email"` into **Email**, leave **Name** and **Phone** empty, click "Create customer". Assert three `role="alert"` paragraphs reading `"Name is required."`, `"Enter a valid email address."` and `"Phone is required."`, and that **`createCustomerMock` was never called** — `handleSubmit` returns before `mutation.mutate` (`customer-form.tsx:52–56`).

#### `tests/components/assigned-ticket-list.test.tsx` — 1 test

**`badges only the breached ticket`**

No providers, no mocks beyond the `next/link` alias. Build two `TicketListItem` fixtures — one `slaBreached: true` with subject `"Breached ticket"`, one `slaBreached: false` with subject `"Healthy ticket"` — render `<AssignedTicketList tickets={[...]} />`, then assert `screen.getAllByText("SLA breached")` has length **1** and that the badge sits in the breached ticket's row (`within(screen.getByRole("row", { name: /Breached ticket/ }))`).

#### `tests/components/notification-bell.test.tsx` — 1 test

**`drops the unread count after marking notifications read`**

```ts
const { fetchNotificationsMock, markNotificationReadMock } = vi.hoisted(() => ({
  fetchNotificationsMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
}))

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications")>()
  return {
    ...actual,
    fetchNotifications: fetchNotificationsMock,
    markNotificationRead: markNotificationReadMock,
  }
})
```

`fetchNotificationsMock` resolves **two unread items** on the first call and the same two items `read: true` with `unreadCount: 0` on every later call — `mockResolvedValueOnce(...).mockResolvedValue(...)`. Render `<NotificationBell />`, `await screen.findByText("2")` (the count badge, `notification-bell.tsx:47–51`), open the popover, click "Mark all read", then assert `markNotificationReadMock` was called **twice** and `await waitForElementToBeRemoved(() => screen.queryByText("2"))`.

**Reach for `vi.useFakeTimers()` only if the 30 s `refetchInterval` (line 27) proves flaky**; if you do, drive `userEvent` with `advanceTimers: vi.advanceTimersByTime` or its clicks will hang.

### 6 — No application-code changes

**No route, component, schema or `lib/` file is modified by this story.** The intake forbids restructuring for testability. The only existing files that change are `package.json` (one script, six devDependencies) and `package-lock.json`; everything else is new, under `tests/` plus `vitest.config.ts`.

---

## Edge Cases & Failure Modes

- **The suite writes to the dev database.** Trigger: `DATABASE_URL` not reaching a worker, so `lib/prisma.ts:7` falls back to `.env`'s `file:./dev.db`. Consequence: `resetDb()` **empties the developer's dev data**. Guard: `env` is set per-project in `vitest.config.ts`, and the first thing to check on any surprising failure is `npx prisma studio` against `prisma/test.db`. Before the first run, back up: `cp prisma/dev.db prisma/dev.db.story08.bak`, matching the `.story04` / `.story06` / `.story07` convention already in `prisma/`.
- **`SQLITE_BUSY` under parallel workers.** Trigger: two test files writing at once. Enforced away by `fileParallelism: false` (`vitest.config.ts`). Do **not** "fix" a busy error by adding retries.
- **Cross-test leakage.** Trigger: a test relying on rows another test created. Guard: `resetDb()` in `beforeEach` (`tests/setup/api.ts`) plus `signInAs(null)`, so a test that forgets to sign in gets a **401**, not another test's session.
- **`vi.mock` hoisting TDZ.** Trigger: a factory closing over a `const` declared later in the file — `ReferenceError: Cannot access '…' before initialization`. Guard: `vi.hoisted` for every mock the test asserts on, and a bare `() => import("@/tests/mocks/auth")` for `@/auth`.
- **Mocking `@/auth` does not mock `next-auth`.** Trigger: a component test importing something that reaches `auth.ts` transitively. The `components` project mocks `next-auth/react` only; nothing under `tests/components/` may import a route handler or `@/lib/prisma`.
- **Radix in jsdom.** Trigger: clicking a `SelectTrigger` without the task-3 polyfills → `TypeError: target.hasPointerCapture is not a function`. The polyfills are conditional (`if (!Element.prototype.hasPointerCapture)`) so a future jsdom that implements them wins.
- **`userEvent` plus fake timers deadlocks.** Trigger: `vi.useFakeTimers()` without `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. The click promise never settles and the test times out at 5 s with no useful message.
- **`next/link` outside a router.** Trigger: rendering `AssignedTicketList` or `TicketDetail` without the alias. Guard: the `next/link` alias in the `components` project. A stubbed link navigates nowhere, which is why no test clicks one.
- **The sweep rollback test depends on module-mock reach.** Trigger: `vi.mock("@/lib/activity")` failing to intercept the route's import. Guard: `vi.mock` is hoisted above imports by design — keep the route's `import` **below** it, and assert `notifyCalls.count === 2` so a silently-unmocked run fails loudly instead of passing for the wrong reason.
- **`resolvedAt` is a clock read.** `app/api/tickets/[id]/route.ts:111` calls `new Date()`. Assert **not-null**, never a specific value.
- **`describeTicketChanges` writes nothing for a no-op PATCH** (`lib/activity.ts:85`). A test that PATCHes `status: "OPEN"` onto an already-`OPEN` ticket and expects an audit row is asserting the opposite of the intended behaviour.
- **Follow-up, not fixed here (the intake forbids the refactor):** `POST /api/tickets/assign-sweep` reads the clock indirectly through `isSlaHalfElapsed`'s default argument and takes no injectable `now`, so sweep tests must move `createdAt` / `dueAt` rather than freeze time. `app/api/dashboard/route.ts:29` has the same shape. Threading an optional `now` through both handlers is the cleanest later change.
- **Follow-up, not fixed here:** `app/api/tickets/assign-sweep/route.ts:59` dereferences `session!.user.id`, which is safe **only** because `requireAdmin()` ran four lines earlier at line 12. There is no test that can cover that coupling without removing the guard; it is a review-time invariant, noted here so it is not lost.

---

## Test Plan

The deliverable **is** the test plan. 20 tests:

**Integration (`api` project, real SQLite, `@/auth` mocked) — `tests/api/`**

1. `customers.test.ts` → creates a customer and lists it.
2. `customers.test.ts` → rejects a customer with no phone (400, `fieldErrors.phone`).
3. `register.test.ts` → creates a linked `User` + `Customer` for a new email.
4. `register.test.ts` → links to an existing unlinked customer instead of duplicating.
5. `register.test.ts` → rejects a duplicate email (409).
6. `tickets.test.ts` → creates, claims and resolves a ticket.
7. `tickets.test.ts` → refuses to move a closed ticket out of `CLOSED` (409).
8. `tickets.test.ts` → forbids a non-admin agent reassigning to another agent (403).
9. `tickets.test.ts` → allows an admin to perform the same reassignment (200).
10. `activity.test.ts` → writes an audit row on a status change.
11. `activity.test.ts` → notifies the agent who gains a ticket.
12. `assign-sweep.test.ts` → claims an eligible aging ticket for the least loaded agent.
13. `assign-sweep.test.ts` → records the same audit row and notification as a manual claim.
14. `assign-sweep.test.ts` → rolls back completely when one assignment fails.
15. `feedback.test.ts` → rejects feedback on a ticket that is not resolved (409).
16. `feedback.test.ts` → accepts feedback on a resolved ticket (201).

**Component (`components` project, jsdom + RTL) — `tests/components/`**

17. `ticket-status-control.test.tsx` → changes status through the select and locks the control when closed.
18. `customer-form.test.tsx` → shows field errors and does not submit invalid input.
19. `assigned-ticket-list.test.tsx` → badges only the breached ticket.
20. `notification-bell.test.tsx` → drops the unread count after marking notifications read.

**No test is removed or modified** — there are none. **No snapshot tests**: a snapshot of a shadcn component records Tailwind classes, which is churn, not coverage.

---

## Migration / Rollback

- **No schema change and no migration.** `prisma db push --force-reset` in `tests/global-setup.ts` targets `prisma/test.db` only, and `--skip-generate` keeps it from touching the generated client.
- **Back up first**: `cp prisma/dev.db prisma/dev.db.story08.bak`. The single realistic way this story destroys data is a `DATABASE_URL` that fails to reach a worker, and the backup is the entire mitigation.
- **Rollback**: delete `vitest.config.ts` and `tests/`, revert the `package.json` script and the six devDependencies, then `npm install` to rewrite `package-lock.json`. Delete `prisma/test.db`. Nothing in `app/`, `components/`, `lib/` or `prisma/schema.prisma` was touched, so there is nothing else to undo.
- **Half-applied state**: dependencies installed but `vitest.config.ts` missing → `npm run test` runs with Vitest's defaults, finds no `projects`, loads no setup file, and every API test writes to **`prisma/dev.db`**. Add the config before the first `npm run test`, not after.

---

## Verification Steps

1. **Dependencies installed:** `npm install --save-dev vitest@^4.1.11 jsdom@^30.0.1 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.1 @testing-library/user-event@^14.6.6 @testing-library/jest-dom@^7.0.1` in the repo root. `npm ls @testing-library/dom` resolves with **no unmet peer warning** from `@testing-library/react` or `@testing-library/jest-dom`.
2. **No runtime dependency moved:** `git diff package.json` shows a new `"test"` script and additions under `devDependencies` **only**. The `dependencies` block is byte-identical.
3. **Whole suite runs:** `npm run test` in the repo root. **20 passed, 0 failed, 0 skipped**, across two projects (`api`, `components`), and the process **exits** rather than watching.
4. **One project at a time:** `npx vitest run --project api` and `npx vitest run --project components`. 16 and 4 respectively. This is what proves the projects are actually separate rather than one config silently matching everything.
5. **The dev database is untouched:** before step 3, note `prisma/dev.db`'s size and its customer count via `npx prisma studio`; after step 3, both are unchanged, and **`prisma/test.db` exists**.
6. **Reruns are clean:** run `npm run test` **twice in a row**. The second run passes identically — proof that `resetDb()` and `--force-reset` leave no state behind. A second run failing on a unique-constraint error means a factory is using a fixed email.
7. **Types still check:** `npx tsc --noEmit` in the repo root. Zero errors, including the new files — `tsconfig.json`'s `include` already covers `tests/**` and `vitest.config.ts`. Run `npm run dev` once first if `.next/types` is stale, so `RouteContext<…>` resolves.
8. **Lint passes:** `npm run lint` in the repo root. Zero errors.
9. **Production build unaffected:** `npm run build` in the repo root succeeds. Nothing under `tests/` may end up in a bundle; a build error here means a test file was placed inside `app/` or `components/`.
10. **The rollback test is real:** temporarily change `notifyCalls.count === 2` to `=== 99` in `tests/api/assign-sweep.test.ts` and rerun — the test must **fail** (the sweep now succeeds and the post-conditions no longer hold). Revert. A test that passes both ways is asserting nothing.
11. **Regression:** `npm run dev`, then click through `/agent`, `/agent/tickets`, a ticket detail page, `/agent/customers/new`, `/agent/reports`, the notification bell, `/portal/tickets` and `/register`. This story changes no application behaviour; anything different is a bug introduced by the diff.

---

## Done Criteria

- [ ] `npm run test` exists, runs `vitest run` (**not** watch mode), and reports **20 passing tests, 0 failing**.
- [ ] `vitest.config.ts` defines two projects — `api` (`node`, `tests/api/**/*.test.ts`) and `components` (`jsdom`, `tests/components/**/*.test.tsx`) — with `fileParallelism: false` and the `@` alias declared in **each** project.
- [ ] The `api` project sets `DATABASE_URL` to `file:./test.db`, and `tests/global-setup.ts` creates that database with `prisma db push --force-reset --skip-generate`. **`prisma/dev.db` is unchanged by a test run.**
- [ ] `resetDb()` runs in `beforeEach` for every API test and deletes in FK-safe order (feedback → comment → notification → auditLog → ticket → customer → user).
- [ ] Sessions come from `tests/mocks/auth.ts` via `vi.mock("@/auth", () => import("@/tests/mocks/auth"))`. **Prisma is never mocked** — every API test hits real SQLite.
- [ ] API tests exist and pass for: customer create + list; customer validation failure; registration creating a linked `User` + `Customer`; registration **linking** an unlinked `Customer` via `userId` **without creating a second row**; duplicate-email registration rejected; ticket create + assign + status change; the invalid `CLOSED →` transition (409); non-admin reassignment **403**; admin reassignment **200**; the sweep claiming an eligible aging ticket; an audit row on a status change; a notification on assignment; sweep-assignment audit + notification parity with a manual claim; **a failed sweep leaving zero audit rows, zero notifications and zero assignments**; feedback rejected on a non-resolved ticket; feedback accepted on a resolved one.
- [ ] Component tests exist and pass for: the ticket status control (changes status **and** is disabled with a "Reopen ticket" button when `CLOSED`); the customer form showing validation errors **without** calling `createCustomer`; the dashboard SLA-breach badge appearing on the breached row **only**; the notification bell's unread count dropping after "Mark all read".
- [ ] `tests/setup/dom.ts` extends `expect` with `@testing-library/jest-dom/vitest`, registers `afterEach(cleanup)` (because `globals` stays `false`), and polyfills `hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` / `scrollIntoView` / `ResizeObserver`.
- [ ] `next/link` is aliased to `tests/stubs/next-link.tsx` for the `components` project; no component test mounts `app/providers.tsx`.
- [ ] **No file under `app/`, `components/`, `lib/`, `prisma/` or `middleware.ts` is modified.** `git diff --stat` outside `tests/`, `vitest.config.ts`, `package.json` and `package-lock.json` is empty.
- [ ] Every added package is a **devDependency**; no pinned version in `dependencies` moved; `@vitejs/plugin-react` and `vite-tsconfig-paths` are **not** installed.
- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass with the tests in the tree.
- [ ] Running `npm run test` twice in succession passes both times.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 10.**
