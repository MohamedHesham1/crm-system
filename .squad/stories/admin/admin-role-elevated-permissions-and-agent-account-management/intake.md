# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/admin/<slug-will-be-generated>/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Admin
- **Feature slug (folder under `plans/`):** `admin`

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
Admin role: elevated permissions and agent account management
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Adds ADMIN as a third role, layered on top of AGENT/CUSTOMER. ADMIN is a
strict superset of AGENT — same access, plus agent-account management and
(from a later story) ticket reassignment authority. Not a separate portal.
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
- `lib/roles.ts`: `ROLES` extended to `["AGENT", "CUSTOMER", "ADMIN"]`
- `lib/roles.ts` refactored to a single `Record<Role, {...}>` config table
  as the one source of truth for per-role routing and staff status, with
  `homeForRole()` and `isStaff()` both derived from it rather than each
  carrying its own separate ternary:
    const ROLE_CONFIG: Record<Role, { home: string; isStaff: boolean }> = {
      AGENT:    { home: "/agent",  isStaff: true  },
      ADMIN:    { home: "/agent",  isStaff: true  },
      CUSTOMER: { home: "/portal", isStaff: false },
    }
  The `Record<Role, ...>` annotation is the point: adding a future role
  without giving it a home and isStaff value becomes a compile error
  (TS2741), not a silent runtime misroute
- `homeForRole()` must return `/agent` for ADMIN. The pre-existing
  implementation (`role === "AGENT" ? "/agent" : "/portal"`) silently
  routes ADMIN to the customer portal — a real bug this story must fix,
  affecting both the root page redirect and middleware's signed-in
  bounce off `/login`
- `app/agent/layout.tsx` and `middleware.ts`'s role-redirect logic updated
  to use `isStaff()` instead of the hardcoded `role === "AGENT"` check —
  broadening only: existing AGENT behavior must not change
- Seed script extended: one additional seeded user, role `ADMIN`
  (`admin@crm.local`, same password pattern as the existing seeded users)
- New `requireAdmin()` helper (same shape as story 02's `requireAgent()`),
  used to guard admin-only API routes
- `app/api/admin/users` — `GET` (list all users), `POST` (create a new
  AGENT or ADMIN account: name, email, password, role) — both
  `requireAdmin()`-guarded, Zod-validated
- `app/agent/admin/users` — admin-only page listing all users; non-admins
  visiting this route are redirected to `/agent`, not shown a 403 page
- `app/agent/admin/users/new` — admin-only create form for a new agent
  or admin account
- Sidebar: an "Admin" section link visible only when
  `session.user.role === "ADMIN"`
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** story 01-scaffold — User model, lib/roles.ts, lib/password.ts, app/agent/layout.tsx, sidebar-nav.tsx must already exist

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- `requireAdmin()` should mirror `requireAgent()`'s shape from story 02 exactly (401 for no session, 403 for wrong role). Reuse `lib/password.ts`'s `hashPassword()` for the new account form. The ROLE_CONFIG table must be the only place role-to-route and role-to-staff logic lives — after this story, grep for `role === "AGENT"` outside lib/roles.ts should return no matches; any remaining call site should go through `homeForRole()` or `isStaff()`. Prisma is pinned to 6.19.3. If new shadcn components are needed, expect `--base radix --preset nova`. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Editing or deactivating existing accounts (create + list only), password reset flows, granular permission levels beyond the flat ADMIN/AGENT split, self-service admin signup
