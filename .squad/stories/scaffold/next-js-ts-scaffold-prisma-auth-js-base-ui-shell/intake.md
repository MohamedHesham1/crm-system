# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/scaffold/next-js-ts-scaffold-prisma-auth-js-base-ui-shell/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Scaffold
- **Feature slug (folder under `plans/`):** `scaffold`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Next.js + TS scaffold: Prisma, Auth.js, base UI shell
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Foundation for the whole app: Next.js App Router project, Prisma schema on
SQLite, Auth.js credentials-based login with role-aware sessions, Tailwind
CSS + shadcn/ui, and the base route/layout structure everything else
builds on.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Next.js (App Router) + TypeScript strict mode, builds clean with `npm run build`
- Tailwind CSS + shadcn/ui installed and configured
- Prisma schema on SQLite datasource with a `User` model: id, name, email,
  passwordHash, role (`AGENT` | `CUSTOMER`), timestamps
- Auth.js configured with Credentials provider, JWT session strategy,
  `role` included on the session object
- Route groups: `app/agent/**` requires role `AGENT`, `app/portal/**`
  requires role `CUSTOMER`, `app/(auth)/**` is public (login page)
- Base layouts: sidebar nav for the agent area, simple top nav for the
  customer portal
- Seed script creates one agent user and one customer user with known
  credentials for manual testing
- Fresh clone → `npm install && npx prisma migrate dev && npm run seed &&
  npm run dev` → login page renders, both seeded users can authenticate
  and land in their respective areas
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** none

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Stack: Next.js App Router, TypeScript, Prisma + SQLite, Auth.js, Zod for
  validation, Tailwind + shadcn/ui, TanStack Query for client data fetching.
  API routes live under `app/api/**` — no separate Express server.
  Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Real email/SMS/WhatsApp, ERP integration, multi-branch/department,
    custom branding, localization (English only for the eval)
