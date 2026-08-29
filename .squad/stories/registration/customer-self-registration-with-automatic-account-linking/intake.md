# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/registration/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Registration
- **Feature slug (folder under `plans/`):** `registration`

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
Customer self-registration with automatic account linking
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
A public registration path for customers, mirroring the existing login
page's pattern. On success, the new login is either linked to an existing
Customer record (matched by email) or a new Customer record is created
alongside it — replacing what would otherwise be a fragile implicit
email-match with an explicit foreign key that later stories can rely on.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- Prisma: `Customer.userId String? @unique` (nullable — a Customer may
  exist with no linked login, e.g. agent-created and never registered)
- `app/(auth)/register/page.tsx` — public form: name, email, password,
  same layout pattern and shadcn Card as the existing login page
- Zod schema for registration input, reusing the email
  `.trim().toLowerCase()` normalization already established in
  lib/validation/auth.ts
- `POST /api/register` (public, no auth guard):
  - Reject with a clear error if a User with that email already exists
  - Case-insensitive lookup: does an unlinked Customer row (userId is
    null) exist with this email?
    - Match → create the User (role CUSTOMER, hashed password via the
      existing lib/password.ts), set that Customer's userId to the new
      User's id
    - No match → create the User and a new Customer record together
      (same email, name) in one transaction
  - Auto sign-in on success, reusing the existing signIn("credentials", ...)
    pattern from login-form.tsx/actions.ts, redirect to /portal
- Seed script updated: the existing seeded customer@crm.local User gets
  an explicit linked Customer record via Customer.userId — the same
  clean pattern real registrations use, no special-casing for the seed
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold (User model, lib/password.ts, Credentials sign-in pattern, (auth) route group, login-form.tsx to mirror), story 02-customers (Customer model, email uniqueness)

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- Mirror `login-form.tsx`'s client component + server action pattern for the register form rather than inventing a new one. The match-then-link-or-create logic must run inside a single `prisma.$transaction` so a partial failure (User created, Customer link or creation fails) can't happen. Prisma is pinned to 6.19.3. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Email verification (no email infrastructure — a known, accepted risk: anyone who knows a Customer's email can currently claim that record; fine for a 1-day eval, would need addressing in production), password reset flow, phone-based registration, an agent-controlled "allow portal signup" toggle (a possible future mitigation, not built here), OAuth/social login
