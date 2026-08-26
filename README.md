# CRM

Next.js App Router + TypeScript CRM foundation: Prisma (SQLite), Auth.js v5 (Credentials, JWT sessions), Tailwind CSS + shadcn/ui, TanStack Query.

## Prerequisites

- Node.js 22+
- npm 10+

## Getting started (fresh clone)

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Seeded logins

| Email | Password | Role |
|---|---|---|
| `agent@crm.local` | `Passw0rd!` | AGENT |
| `customer@crm.local` | `Passw0rd!` | CUSTOMER |

Signing in redirects an `AGENT` to `/agent` and a `CUSTOMER` to `/portal`.

## Project layout

- `app/agent/` — agent-only area (sidebar shell), guarded by `app/agent/layout.tsx`.
- `app/portal/` — customer-only area (top-nav shell), guarded by `app/portal/layout.tsx`.
- `app/(auth)/` — public route group; sign-in lives at `/login`.
- `prisma/` — SQLite schema, migrations, and the seed script (`prisma/seed.ts`).
- `lib/` — Prisma client singleton, role/password helpers, Zod validation schemas.

## Environment variables

See `.env.example`:

- `DATABASE_URL` — SQLite file, resolved relative to `prisma/schema.prisma`.
- `AUTH_SECRET` — required by Auth.js; generate with `openssl rand -base64 32`.
- `AUTH_TRUST_HOST` — required when not deployed on Vercel.
