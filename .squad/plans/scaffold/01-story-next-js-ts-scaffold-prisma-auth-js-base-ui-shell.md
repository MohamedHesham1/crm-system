# Story 01 — Next.js + TS scaffold: Prisma, Auth.js, base UI shell

## Prerequisites

- None. This is the first story in the repository.
- **The repository contains no application code.** Verified during planning: `git log` reports `your current branch 'main' does not have any commits yet`, there is no `package.json`, and the only tracked/untracked content is `.gitignore`, `skills-lock.json`, `.claude/`, `.agents/`, and `.squad/`. Every path in this plan is **created** by this story unless explicitly marked otherwise.
- Toolchain verified on this machine: **Node v22.18.0**, **npm 10.9.3**. Do not add a `packageManager` field for pnpm/yarn — this project uses npm (`.squad/config.yaml` has no package-manager override and the acceptance criteria call `npm install`).
- No sibling feature folders exist yet, so there is no prior plan to follow. `.squad/plans/scaffold/00-overview.md` and `.squad/plans/00-index.md` exist as empty templates and are updated by this story.

---

## Story Goal

Stand up the foundation every later story builds on:

1. A **Next.js App Router + TypeScript (strict)** project at the repository root that builds clean with `npm run build`.
2. **Tailwind CSS + shadcn/ui** installed and wired, with a small set of primitives (`button`, `card`, `input`, `label`) available under `components/ui/`.
3. A **Prisma schema on SQLite** with a `User` model (`id`, `name`, `email`, `passwordHash`, `role`, `createdAt`, `updatedAt`) and a generated initial migration.
4. **Auth.js v5 (`next-auth@beta`)** with a Credentials provider, **JWT session strategy**, and `role` present on both the JWT and the session object.
5. **Role-gated route groups**: `app/agent/**` for `AGENT`, `app/portal/**` for `CUSTOMER`, `app/(auth)/**` public.
6. **Base layouts**: sidebar nav for the agent area, top nav for the customer portal.
7. A **seed script** creating one agent and one customer with known credentials, runnable via `npm run seed`.
8. A **TanStack Query provider** mounted at the root so later stories can fetch client-side without re-plumbing.

**Not in scope for this story:** any CRM domain model beyond `User` (no customers, tickets, deals), no automated test framework (see `## Test Plan`), no email/SMS/WhatsApp, no ERP integration, no multi-branch/department, no custom branding, no localization — English only.

---

## Context — Read These Files First

1. `.squad/stories/scaffold/next-js-ts-scaffold-prisma-auth-js-base-ui-shell/intake.md` — the source story. Read the **Acceptance criteria** block (~lines 58–74) and the **Technical hints** block (~lines 96–100). The `attachments/` directory next to it is **empty** — there are no diagrams or exports to consult.
2. `.gitignore` — **already exists, 10 lines.** Line 1 is `.agents/`; lines 3–10 are the squad-kit managed block delimited by `# Managed by squad-kit — do not edit this block` (line 3) and `# End squad-kit block` (line 10). You will **append** to this file in task 1. **Do not edit or reorder lines 3–10.**
3. `.squad/config.yaml` — read `project.projectRoots` (`.`) and `project.primaryLanguage` (`typescript`). The app is scaffolded **at the repository root**, not in a subdirectory.
4. `.squad/plans/scaffold/00-overview.md` — the story table you update at the end of this plan.
5. Nothing else in the repo is relevant. There is no source tree to grep.

---

## Product rules (from story)

| Rule | Behaviour |
|---|---|
| Roles | Exactly two: `AGENT` and `CUSTOMER`. No admin, no super-user, no multi-role users. |
| Session strategy | **JWT**, not database sessions. `role` must be readable from the token without a DB round-trip. |
| `app/agent/**` | Requires an authenticated user with `role === "AGENT"`. A `CUSTOMER` hitting it is sent to `/portal`. |
| `app/portal/**` | Requires an authenticated user with `role === "CUSTOMER"`. An `AGENT` hitting it is sent to `/agent`. |
| `app/(auth)/**` | Public. An **already-authenticated** user hitting `/login` is sent to their own area. |
| Landing | `/` is a redirector: it reads the session and sends the user to `/login`, `/agent`, or `/portal`. |

---

## Implementation tasks

### 1 — Scaffold Next.js into the non-empty repository root

**`create-next-app` refuses to scaffold into a directory containing unrecognised files.** This repo root contains `.squad/`, `.claude/`, `.agents/`, and `skills-lock.json`, none of which are on `create-next-app`'s allow-list. Scaffolding directly into `.` will abort. Use a temporary directory and move the result up.

Run from the repository root:

```bash
npx create-next-app@latest .next-scaffold-tmp \
  --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-npm --yes
```

Flags are **not** optional:

- `--no-src-dir` — the app lives at `app/` in the repo root. This is what makes the `@/*` alias resolve `@/auth` to the root-level `auth.ts` created in task 4.
- `--import-alias "@/*"` — shadcn/ui requires a configured path alias.
- `--tailwind` — installs **Tailwind CSS v4**. There is **no `tailwind.config.ts`**; theme configuration lives in `app/globals.css` behind `@import "tailwindcss"`. Do not create a `tailwind.config.ts` and do not expect one to exist.

Then move everything up, preserving the existing `.gitignore`, and remove the temp directory:

```bash
# 1. Set the generated .gitignore aside so the move cannot clobber the squad-kit one.
mv .next-scaffold-tmp/.gitignore .next-scaffold-tmp/gitignore.generated

# 2. Move everything else up (dotglob so .eslintrc-style dotfiles come too).
(shopt -s dotglob nullglob && mv .next-scaffold-tmp/* .)

# 3. Append the generated entries to the existing .gitignore, then drop the temp copy.
printf '\n' >> .gitignore
cat gitignore.generated >> .gitignore
rm -f gitignore.generated
rm -rf .next-scaffold-tmp
```

**Two files need special handling:**

- **`.gitignore`** — the existing 10-line squad-kit file must survive; the generated entries are **appended**, never substituted. After the commands above, verify lines 3–10 are unchanged and then add these entries at the end:

  ```gitignore
  # Prisma / SQLite
  /prisma/dev.db
  /prisma/dev.db-journal
  /prisma/*.db
  /prisma/*.db-journal

  # Keep the env template tracked
  !.env.example
  ```

  The `!.env.example` negation is **required**: `create-next-app`'s `.gitignore` contains `.env*`, which would otherwise exclude the template you create in task 3.

- **`README.md`** — overwrite `create-next-app`'s boilerplate in task 12.

**Verify before continuing:** `ls app/ package.json tsconfig.json` succeeds, and `grep '"strict": true' tsconfig.json` matches. `create-next-app` sets `strict: true` by default; if it is absent, set it in `tsconfig.json` under `compilerOptions`.

---

### 2 — Install runtime and dev dependencies

```bash
npm install next-auth@beta @prisma/client bcryptjs zod @tanstack/react-query

npm install -D prisma tsx @tanstack/react-query-devtools
```

Notes that matter:

- **`next-auth@beta` is required.** Auth.js v5 (the version with `handlers`/`auth`/`signIn`/`signOut` exports and a root-level `auth.ts`) ships on the `beta` dist-tag. `next-auth@latest` resolves to v4, whose API does not match any code in this plan.
- **`bcryptjs`, not `bcrypt`.** `bcrypt` is a native addon requiring `node-gyp`; `bcryptjs` is pure JS and installs cleanly everywhere. `bcryptjs@3` **bundles its own TypeScript types** — **do not** install `@types/bcryptjs`; doing so pulls a deprecated stub package that conflicts with the bundled types and breaks `npm run build`.
- **Do not install `@auth/prisma-adapter`.** The session strategy is JWT and the Credentials provider queries Prisma directly, so the adapter is unused. Auth.js also does **not** support database sessions with the Credentials provider — adding the adapter here invites a wiring attempt that cannot work.
- `tsx` runs the TypeScript seed script.

Add to `package.json` — a `postinstall` hook so a fresh clone has a generated Prisma client before `next build`, and the `seed` script the acceptance criteria require:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate",
    "seed": "prisma db seed"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Keep whatever `dev`/`build`/`start`/`lint` values `create-next-app` generated (they may include `--turbopack`); only **add** `postinstall`, `seed`, and the top-level `prisma` block.

---

### 3 — Environment files

**Create file: `.env`** (git-ignored; needed locally by Prisma CLI and Auth.js)

```dotenv
DATABASE_URL="file:./dev.db"
AUTH_SECRET="dev-only-secret-replace-me-with-openssl-rand-base64-32"
AUTH_TRUST_HOST=true
```

**Create file: `.env.example`** (tracked, thanks to the `!.env.example` negation from task 1)

```dotenv
# SQLite file, resolved relative to prisma/schema.prisma
DATABASE_URL="file:./dev.db"

# Generate with: openssl rand -base64 32
AUTH_SECRET=""

# Required when not deployed on Vercel
AUTH_TRUST_HOST=true
```

**`AUTH_SECRET` must be set before `npm run build`.** Auth.js v5 throws `MissingSecret` at build time when it is absent, and the acceptance criterion "builds clean with `npm run build`" will fail.

**`DATABASE_URL="file:./dev.db"` is resolved relative to `prisma/schema.prisma`**, so the database lands at `prisma/dev.db` — which is what task 1's `.gitignore` entries exclude.

---

### 4 — Prisma schema and client singleton

**Create file: `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/// Application roles are "AGENT" | "CUSTOMER".
/// SQLite does not support Prisma `enum` blocks, so `role` is a String
/// constrained in application code by `Role` in `lib/roles.ts`.
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Critical:** **Prisma does not support `enum` on the SQLite provider.** Writing `enum Role { AGENT CUSTOMER }` makes `prisma migrate dev` fail with a validation error. The role is a `String` column; the `AGENT | CUSTOMER` constraint is enforced in TypeScript (task 5) and by the Zod schema in task 6. Do not "fix" this by switching the datasource to PostgreSQL — SQLite is a requirement of the story.

**Create file: `lib/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

The `globalThis` cache is **required**: without it, Next.js dev-server hot reload creates a new `PrismaClient` per reload and exhausts SQLite connections.

Generate the client and the initial migration:

```bash
npx prisma migrate dev --name init
```

This creates `prisma/migrations/<timestamp>_init/migration.sql` — **commit that directory.**

---

### 5 — Role type and password helpers

**Create file: `lib/roles.ts`**

```ts
export const ROLES = ["AGENT", "CUSTOMER"] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** Landing route for a role. Used by `/` and by the post-login redirect. */
export function homeForRole(role: Role): "/agent" | "/portal" {
  return role === "AGENT" ? "/agent" : "/portal"
}
```

**Create file: `lib/password.ts`**

```ts
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

**`lib/password.ts` must never be imported from `middleware.ts` or from `auth.config.ts`** — `bcryptjs` and `@prisma/client` are Node-runtime only, and Next.js middleware runs on the Edge runtime. Importing them there produces a build-time error. Task 8 keeps the two configs separate precisely for this reason.

---

### 6 — Zod validation schema

**Create file: `lib/validation/auth.ts`**

```ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
})

export type LoginInput = z.infer<typeof loginSchema>
```

`.toLowerCase()` on email is deliberate: the seed script (task 10) stores lowercase emails, and `User.email` is `@unique` — case-normalising at the boundary prevents "user exists but cannot log in" reports.

---

### 7 — Auth.js type augmentation

**Create file: `types/next-auth.d.ts`**

```ts
import type { DefaultSession } from "next-auth"
import type { Role } from "@/lib/roles"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
  }
}
```

The default `tsconfig.json` `include` from `create-next-app` (`"**/*.ts"`, `"**/*.tsx"`, `"next-env.d.ts"`, `".next/types/**/*.ts"`) already picks this file up. **Do not** add a `typeRoots` entry.

---

### 8 — Auth.js configuration — split edge-safe / Node config

Two files. The split is **mandatory**, not stylistic: `middleware.ts` runs on the Edge runtime and cannot load Prisma or bcryptjs, so the config it imports must contain neither.

**Create file: `auth.config.ts`** (repository root — edge-safe, **no Prisma, no bcryptjs**)

```ts
import type { NextAuthConfig } from "next-auth"
import type { Role } from "@/lib/roles"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role as Role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
```

`providers: []` is correct here — the real provider is added in `auth.ts`. `session.strategy: "jwt"` lives in the shared config so middleware and the server both agree.

**Create file: `auth.ts`** (repository root — Node runtime)

```ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { loginSchema } from "@/lib/validation/auth"
import { isRole } from "@/lib/roles"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) return null
        if (!isRole(user.role)) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
})
```

`authorize` returns `null` — never throws — for every failure path (bad shape, unknown email, wrong password, corrupt role). Auth.js converts `null` into a `CredentialsSignin` error, which task 11 renders as a single generic message. **Do not** return different errors for "unknown email" and "wrong password"; that leaks account existence.

**Create file: `app/api/auth/[...nextauth]/route.ts`**

```ts
export { GET, POST } from "@/auth"
```

`handlers` is destructured into `GET`/`POST` by the export above only because `auth.ts` exports `handlers` — if TypeScript complains, use the explicit form:

```ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

Prefer the explicit form.

---

### 9 — Middleware route guard

**Create file: `middleware.ts`** (repository root)

```ts
import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/auth.config"
import { homeForRole } from "@/lib/roles"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const user = req.auth?.user
  const path = nextUrl.pathname

  const isLogin = path === "/login"
  const isAgentArea = path === "/agent" || path.startsWith("/agent/")
  const isPortalArea = path === "/portal" || path.startsWith("/portal/")

  if (!user) {
    if (isAgentArea || isPortalArea) {
      const url = new URL("/login", nextUrl)
      url.searchParams.set("callbackUrl", path)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  const home = homeForRole(user.role)

  if (isLogin) return NextResponse.redirect(new URL(home, nextUrl))
  if (isAgentArea && user.role !== "AGENT") return NextResponse.redirect(new URL(home, nextUrl))
  if (isPortalArea && user.role !== "CUSTOMER") return NextResponse.redirect(new URL(home, nextUrl))

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

- **`middleware.ts` imports `@/auth.config`, never `@/auth`.** Importing `@/auth` drags Prisma and bcryptjs into the Edge bundle and fails the build. This is the single most likely way to break this story.
- The matcher excludes `api` so `/api/auth/**` is never intercepted — intercepting it breaks the sign-in POST.
- Middleware is **UX, not the security boundary.** The authoritative checks are the server-component layout guards in tasks 13 and 14.

---

### 10 — Seed script

**Create file: `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const SEED_PASSWORD = "Passw0rd!"

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  await prisma.user.upsert({
    where: { email: "agent@crm.local" },
    update: { name: "Ava Agent", passwordHash, role: "AGENT" },
    create: {
      name: "Ava Agent",
      email: "agent@crm.local",
      passwordHash,
      role: "AGENT",
    },
  })

  await prisma.user.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", passwordHash, role: "CUSTOMER" },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      passwordHash,
      role: "CUSTOMER",
    },
  })

  console.log("Seeded users:")
  console.log(`  agent@crm.local    / ${SEED_PASSWORD}  (AGENT)`)
  console.log(`  customer@crm.local / ${SEED_PASSWORD}  (CUSTOMER)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

`upsert` (not `create`) makes `npm run seed` **idempotent** — re-running it must not fail with a unique-constraint error on `email`.

The seed instantiates its own `PrismaClient` rather than importing `@/lib/prisma` because it runs under `tsx` outside the Next.js module graph, where the `@/*` alias is not resolved.

---

### 11 — shadcn/ui initialisation and primitives

```bash
npx shadcn@latest init --yes
npx shadcn@latest add button card input label
```

- `init` writes **`components.json`** and rewrites `app/globals.css` with the shadcn design tokens (`--background`, `--foreground`, `--primary`, …) as Tailwind v4 `@theme` variables. It also adds `lib/utils.ts` exporting `cn`. **Do not hand-write `lib/utils.ts`** — let the CLI create it, then leave it alone.
- Components land in `components/ui/`.
- If `init` prompts despite `--yes`, accept the defaults: base colour `neutral`, CSS variables **yes**.
- **Only these four primitives.** Do not add `form` — the login form uses a server action with `useActionState`, so `react-hook-form` and `@hookform/resolvers` are not needed and would be dead weight.

---

### 12 — Root layout, providers, and landing redirect

**Create file: `app/providers.tsx`**

```tsx
"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  )
}
```

`useState(() => new QueryClient())` — **not** a module-level `new QueryClient()`. A module-level client is shared across requests on the server and leaks one user's cached data into another's response.

**File: `app/layout.tsx`** (created by `create-next-app` in task 1 — edit it)

Keep the generated font setup and `globals.css` import. Wrap `{children}` in `<Providers>` and set the metadata:

```tsx
export const metadata: Metadata = {
  title: "CRM",
  description: "Customer relationship management",
}
```

**File: `app/page.tsx`** (created by `create-next-app` — **replace its entire contents**)

```tsx
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { homeForRole } from "@/lib/roles"

export default async function RootPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  redirect(homeForRole(session.user.role))
}
```

`redirect()` throws a `NEXT_REDIRECT` control-flow error by design — **do not wrap it in `try`/`catch`.**

**File: `README.md`** (created by `create-next-app` — replace its contents) with: prerequisites (Node 22+), the fresh-clone command sequence from `## Verification Steps`, the two seeded logins, and a short "project layout" section naming `app/agent/`, `app/portal/`, `app/(auth)/`, `prisma/`, and `lib/`.

---

### 13 — Public auth area and login page

**Create file: `app/(auth)/layout.tsx`**

```tsx
import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {children}
    </main>
  )
}
```

`(auth)` is a **route group** — the parentheses mean it does not appear in the URL. The login page is at `/login`, not `/auth/login`.

**Create file: `app/(auth)/login/actions.ts`**

```ts
"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"
import { loginSchema } from "@/lib/validation/auth"

export type LoginState = { error?: string }

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." }
    }
    throw error
  }

  return {}
}
```

**The `throw error` on the last line is mandatory.** On success, `signIn` throws a `NEXT_REDIRECT` error that Next.js must receive to perform the redirect. Catching everything — or returning a value instead of re-throwing — silently breaks login with no visible error. Only `AuthError` instances are handled.

`redirectTo: "/"` sends the user to the landing redirector from task 12, which then routes them by role. This is why the action does not need to know the user's role.

**Create file: `app/(auth)/login/login-form.tsx`**

```tsx
"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type LoginState } from "./actions"

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

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

`useActionState` is imported from **`react`** (React 19), not from `react-dom`. `useFormStatus` **is** from `react-dom` and **must** live in a child component of the `<form>` — calling it inside `LoginForm` itself always returns `pending: false`.

**Create file: `app/(auth)/login/page.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your CRM account to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
```

---

### 14 — Agent area: sidebar shell, guarded

**Create file: `components/sign-out-button.tsx`**

```tsx
import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}
```

A server component with an inline server action — no client bundle, no `next-auth/react` import.

**Create file: `components/agent/sidebar-nav.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [{ href: "/agent", label: "Dashboard" }] as const

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === link.href
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

`LINKS` holds a single entry on purpose — later stories append to this array rather than restructuring the component.

**Create file: `app/agent/layout.tsx`**

```tsx
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SidebarNav } from "@/components/agent/sidebar-nav"
import { SignOutButton } from "@/components/sign-out-button"

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "AGENT") redirect("/portal")

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30 p-4">
        <div className="mb-6 px-3 text-lg font-semibold">CRM</div>
        <SidebarNav />
        <div className="mt-auto border-t pt-4">
          <p className="px-3 pb-2 text-sm text-muted-foreground">{session.user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

**This layout — not the middleware — is the authoritative guard for `app/agent/**`.** It re-runs on every request to every page under `app/agent/`, in the Node runtime, with a verified session.

**Create file: `app/agent/page.tsx`**

```tsx
import { auth } from "@/auth"

export default async function AgentDashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Agent dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as {session?.user.name} ({session?.user.role}).
      </p>
    </div>
  )
}
```

---

### 15 — Customer portal: top-nav shell, guarded

**Create file: `components/portal/top-nav.tsx`**

```tsx
import Link from "next/link"

import { SignOutButton } from "@/components/sign-out-button"

export function TopNav({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/portal" className="text-lg font-semibold">
        CRM Portal
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{email}</span>
        <SignOutButton />
      </div>
    </header>
  )
}
```

**Create file: `app/portal/layout.tsx`**

```tsx
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { TopNav } from "@/components/portal/top-nav"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "CUSTOMER") redirect("/agent")

  return (
    <div className="min-h-screen">
      <TopNav email={session.user.email ?? ""} />
      <main className="mx-auto max-w-4xl p-8">{children}</main>
    </div>
  )
}
```

**Create file: `app/portal/page.tsx`**

```tsx
import { auth } from "@/auth"

export default async function PortalHomePage() {
  const session = await auth()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome, {session?.user.name}</h1>
      <p className="text-muted-foreground">Your requests and updates will appear here.</p>
    </div>
  )
}
```

---

## Edge Cases & Failure Modes

- **`create-next-app` aborts: "directory has files that could conflict".** Trigger: scaffolding into `.` while `.squad/`, `.claude/`, `.agents/`, `skills-lock.json` are present. Handled by the temp-directory approach in task 1. Do **not** delete those directories to make room.
- **`.gitignore` clobbered.** Trigger: `mv .next-scaffold-tmp/* .` with `dotglob` replaces the existing 10-line file. Expected: the squad-kit block (lines 3–10) survives verbatim and `create-next-app`'s entries are appended. Verify with `grep -c 'End squad-kit block' .gitignore` → `1`.
- **`.env.example` silently untracked.** Trigger: `create-next-app`'s `.gitignore` contains `.env*`. Expected: the `!.env.example` negation from task 1 keeps it tracked. Verify with `git check-ignore -v .env.example` → **no output** (exit code 1).
- **`prisma migrate dev` fails with an enum validation error.** Trigger: declaring `enum Role` in `prisma/schema.prisma`. SQLite does not support Prisma enums. Expected: `role String` per task 4, constrained by `lib/roles.ts`.
- **Build fails with "The edge runtime does not support Node.js 'crypto'/'fs' module" or a Prisma engine error.** Trigger: `middleware.ts` importing `@/auth`, `@/lib/prisma`, or `@/lib/password` instead of `@/auth.config`. Enforced by the import list in task 9.
- **Build fails with `MissingSecret`.** Trigger: `npm run build` without `AUTH_SECRET` in the environment. Task 3 sets it in `.env`; a CI runner needs it exported explicitly.
- **Login form appears to do nothing on correct credentials.** Trigger: `loginAction` catching all errors instead of re-throwing non-`AuthError`. The success path *is* a thrown `NEXT_REDIRECT`. Enforced by the `throw error` line in task 13.
- **Login always fails on a correct password entered with different casing in the email.** Trigger: `User.email` is `@unique` and case-sensitive in SQLite. Handled by `.toLowerCase()` in `loginSchema` (task 6) plus lowercase emails in the seed (task 10).
- **`npm run seed` fails on the second run.** Trigger: `create` instead of `upsert` hitting the unique constraint on `email`. Handled in task 10.
- **`role` missing from `session.user` at runtime, or a TS error on `session.user.role`.** Trigger: `types/next-auth.d.ts` absent, or the `jwt`/`session` callbacks placed in `auth.ts` instead of `auth.config.ts` (middleware then reads a token with no `role`). Enforced by tasks 7 and 8.
- **`SALT_ROUNDS` mismatch.** `prisma/seed.ts` hardcodes `10` and `lib/password.ts` exports `SALT_ROUNDS = 10`. bcrypt encodes the cost in the hash, so verification works regardless — but keep both at `10` so seeded and app-created users behave identically.
- **A `CUSTOMER` deep-links to `/agent/anything`.** Expected: middleware redirects to `/portal`; if middleware is bypassed, `app/agent/layout.tsx` redirects. Both layers must be present.
- **A signed-in user navigates to `/login`.** Expected: middleware redirects to `homeForRole(role)`. There is no layout-level check on `(auth)` — this one is middleware-only, which is acceptable because it is a convenience, not a security boundary.
- **Fresh clone with no `prisma/dev.db`.** Trigger: the database file is git-ignored. Expected: `npx prisma migrate dev` creates and migrates it; `npm run seed` populates it. Both are in the documented sequence.

---

## Test Plan

**No automated test framework is installed by this story.** The intake's acceptance criteria specify a manual fresh-clone smoke test and list no testing requirement, and installing Vitest/Playwright here would exceed the story's scope. Installing the test harness is a follow-up for Story 02; note it in `## Dependency notes` of `00-overview.md`.

The tests below are **manual smoke tests** run against `npm run dev` at `http://localhost:3000`. Record pass/fail for each before calling the story done.

1. **Unauthenticated redirect (smoke).** Visit `/`. Expect a redirect to `/login` and the "Sign in" card rendering with email and password fields.
2. **Deep-link redirect (smoke).** Visit `/agent/` while signed out. Expect a redirect to `/login?callbackUrl=%2Fagent`.
3. **Agent login (integration).** Submit `agent@crm.local` / `Passw0rd!`. Expect a landing on `/agent`, the sidebar with "CRM" and the "Dashboard" link, the email in the sidebar footer, and the body text reading "Signed in as Ava Agent (AGENT)."
4. **Agent cross-area block (integration).** While signed in as the agent, visit `/portal`. Expect a redirect back to `/agent`.
5. **Customer login (integration).** Sign out, then submit `customer@crm.local` / `Passw0rd!`. Expect a landing on `/portal`, the top nav reading "CRM Portal", and a heading "Welcome, Cody Customer".
6. **Customer cross-area block (integration).** While signed in as the customer, visit `/agent`. Expect a redirect back to `/portal`.
7. **Signed-in user at `/login` (smoke).** While signed in as either user, visit `/login`. Expect a redirect to that user's own area.
8. **Bad credentials (integration).** Sign out, then submit `agent@crm.local` / `wrong`. Expect the form to stay on `/login` and render "Invalid email or password." in the destructive-coloured `role="alert"` paragraph. Repeat with `nobody@crm.local` / `Passw0rd!` and expect the **same** message — the two cases must be indistinguishable.
9. **Email case-insensitivity (integration).** Submit `AGENT@CRM.LOCAL` / `Passw0rd!`. Expect a successful login to `/agent`.
10. **Seed idempotency (unit-ish).** Run `npm run seed` twice. Expect both runs to exit `0` and print the two credential lines; no unique-constraint error.
11. **Sign out (smoke).** From `/agent`, click "Sign out". Expect a redirect to `/login` and that revisiting `/agent` redirects back to `/login`.

---

## Migration / Rollback

- **Migration:** `npx prisma migrate dev --name init` creates `prisma/migrations/<timestamp>_init/migration.sql` and `prisma/dev.db`. The migration directory is **committed**; the `.db` file is **git-ignored**.
- **Half-applied state:** if `migrate dev` fails partway, `prisma/dev.db` may exist without a `_prisma_migrations` row. Recover with `rm -f prisma/dev.db prisma/dev.db-journal && npx prisma migrate dev --name init && npm run seed`. This is a development-only SQLite file — deleting it is always safe at this stage.
- **Rollback of the whole story:** the repository had **zero commits** before this work. Rollback is `git reset --hard` to the empty state plus `rm -rf node_modules .next app components lib prisma types public auth.ts auth.config.ts middleware.ts package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs components.json next-env.d.ts .env .env.example`, then restoring `.gitignore` to its original 10 lines. **Do not** delete `.squad/`, `.claude/`, `.agents/`, or `skills-lock.json`.

---

## Verification Steps

Run everything from the repository root, `/home/mohesham/Web Dev/crm-system`.

1. **Dependencies install:** `npm install` — exits `0`, and the `postinstall` hook prints "Generated Prisma Client".
2. **Database and migration:** `npx prisma migrate dev --name init` — creates `prisma/migrations/<timestamp>_init/` and `prisma/dev.db`, exits `0`.
3. **Seed:** `npm run seed` — prints both credential lines and exits `0`. Run it a **second** time and confirm it still exits `0`.
4. **Backend/frontend builds:** `npm run build` — completes with **no TypeScript errors and no ESLint errors**. Confirm the route table lists `/`, `/login`, `/agent`, `/portal`, and `/api/auth/[...nextauth]`.
5. **Lint:** `npm run lint` — exits `0`.
6. **App runs:** `npm run dev`, then work through all 11 items in `## Test Plan` at `http://localhost:3000`.
7. **Fresh-clone criterion (the acceptance test):** from a clean checkout, `npm install && npx prisma migrate dev && npm run seed && npm run dev` — the login page renders and both seeded users authenticate into their own areas.

---

## Done Criteria

- [ ] Next.js App Router + TypeScript with `"strict": true` in `tsconfig.json`; `npm run build` exits `0` with no TS or ESLint errors.
- [ ] Tailwind CSS v4 configured and `components.json` present; `components/ui/` contains `button`, `card`, `input`, `label` from shadcn/ui.
- [ ] `prisma/schema.prisma` declares a `sqlite` datasource and a `User` model with `id`, `name`, `email` (`@unique`), `passwordHash`, `role` (String — **not** a Prisma enum), `createdAt`, `updatedAt`.
- [ ] `prisma/migrations/<timestamp>_init/migration.sql` exists and is committed; `prisma/dev.db` is git-ignored.
- [ ] `auth.ts` configures a Credentials provider with `session.strategy: "jwt"`; `types/next-auth.d.ts` puts `role: Role` on `Session["user"]`, `User`, and `JWT`.
- [ ] `middleware.ts` imports `@/auth.config` only — `grep -E "@/auth[\"']|@/lib/prisma|@/lib/password" middleware.ts` returns **no matches**.
- [ ] `app/agent/layout.tsx` redirects non-`AGENT` users; `app/portal/layout.tsx` redirects non-`CUSTOMER` users; `app/(auth)/login/page.tsx` is reachable signed out.
- [ ] The agent area renders a sidebar nav; the customer portal renders a top nav; both show the signed-in email and a working "Sign out" control.
- [ ] `npm run seed` creates `agent@crm.local` (`AGENT`) and `customer@crm.local` (`CUSTOMER`), both with password `Passw0rd!`, and is idempotent across repeated runs.
- [ ] `.env.example` is tracked (`git check-ignore .env.example` exits non-zero) and documents `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`.
- [ ] `.gitignore` still contains the untouched squad-kit block plus the Next.js and Prisma entries.
- [ ] `README.md` documents the fresh-clone sequence and the two seeded logins.
- [ ] All 11 manual smoke tests in `## Test Plan` pass.
- [ ] `.squad/plans/scaffold/00-overview.md` and `.squad/plans/00-index.md` list this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02.**
