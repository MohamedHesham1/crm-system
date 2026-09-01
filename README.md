# CRM

A support-ticket CRM built with Next.js App Router and TypeScript: Prisma
(SQLite), Auth.js v5 (Credentials, JWT sessions), Tailwind CSS + shadcn/ui,
TanStack Query, and Recharts.

## Features

- **Ticket management** — full CRUD, self-pickup assignment (claim/release,
  admin reassign), status/priority tracking, computed SLA-breach flags, and
  an admin-triggered assignment sweep for aging unassigned tickets.
- **Customer profiles** — agent-managed customer records, linked to
  self-registered portal accounts via `Customer.userId`.
- **Comment threads** — per-ticket discussion between agents and customers.
- **Audit trail & notifications** — every status/priority/assignment change
  is logged, with an in-app notification bell for agents.
- **Reporting dashboard** — SLA on-time rate, average resolution time,
  per-agent load, and customer satisfaction (CSAT), charted with Recharts.
- **Customer feedback** — post-resolution 1–5 rating with an optional
  comment.
- **Role-based access** — AGENT, ADMIN, and CUSTOMER roles, each guarded at
  the API layer through a single `withAuth` declaration per route.
- **Pagination & rate limiting** — ticket and customer lists page through
  results server-side; registration and login are throttled per IP.
- **Soft-deletable tickets** — deleting a ticket preserves its row and audit
  history instead of removing it.
- **Dark/light mode** — system-preference default with an instant,
  no-flash toggle.

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

Then open [http://localhost:3000](http://localhost:3000). Run the test suite
with `npm test` (Vitest + React Testing Library, no separate setup needed —
`tests/global-setup.ts` provisions `prisma/test.db` for you).

## Seeded logins

| Email | Password | Role | Lands on |
|---|---|---|---|
| `agent@crm.local` | `Passw0rd!` | AGENT | `/agent` |
| `customer@crm.local` | `Passw0rd!` | CUSTOMER | `/portal` |
| `admin@crm.local` | `Passw0rd!` | ADMIN | `/agent` |

`admin@crm.local` is a strict superset of `agent@crm.local` — same agent
area and customer/ticket access, plus `/agent/admin/users` (account
management) and `/agent/admin/audit` (the audit trail). `customer@crm.local`
is seeded with a real linked `Customer` row (`Customer.userId`), the same
shape self-registration produces — plus three unlinked demo customers
(`nadia@northwind.example`, `tom@lakeside.example`, `priya@helio.example`)
for exercising the registration email-match path, and one unassigned demo
ticket. Re-running `npm run seed` is idempotent.

## Environment variables

See `.env.example`:

- `DATABASE_URL` — SQLite file, resolved relative to `prisma/schema.prisma`.
- `AUTH_SECRET` — required by Auth.js; generate with `openssl rand -base64 32`.
- `AUTH_TRUST_HOST` — required when not deployed on Vercel.

## Project layout

- `app/(auth)/` — public route group: `/login`, `/register`.
- `app/agent/` — staff area (AGENT + ADMIN), sidebar shell: dashboard,
  customers, tickets, reports, and `admin/` (users, audit trail — ADMIN only).
- `app/portal/` — customer area, top-nav shell: tickets, FAQ.
- `app/api/` — every route handler, wrapped in `withAuth` (`lib/api/http.ts`)
  so each declares its required role; `middleware.ts` excludes `/api/**`
  from its matcher, so the wrapper is what actually guards these routes.
- `prisma/` — SQLite schema, migrations, and the seed script (`seed.ts`).
- `lib/` — Prisma client singleton, role/session helpers, Zod validation
  schemas, the pure decision functions (`ticket-access.ts`, `sla.ts`,
  `activity.ts`, `report-metrics.ts`), pagination and rate-limiting
  helpers, and the client-side data modules.
- `tests/` — Vitest suite: `tests/api/**` (route handlers against a real
  SQLite `prisma/test.db`, `next-auth` mocked) and `tests/components/**`
  (React Testing Library, jsdom).

## Development history

This project was built as a sequence of squad-kit stories — see
`.squad/stories/` for the intakes and `.squad/plans/` for the generated
implementation plans.
