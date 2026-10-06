# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/accounts/account-profile-deactivation-and-admin-reset/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Account management
- **Feature slug (folder under `plans/`):** `accounts`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Account profile, deactivation, and admin reset
```
Add safe profile self-service and admin lifecycle management without email
delivery: users edit their own profile, admins deactivate accounts and issue
one-time password reset credentials for out-of-band delivery.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Authenticated users can update own display name and allowed contact fields.
  Email changes enforce uniqueness; role and other accounts cannot be changed.
- Admin can deactivate/reactivate accounts. Deactivated users cannot sign in
  or use existing sessions under the documented invalidation policy; ticket
  and audit history remain intact.
- Admin can issue a one-time expiring password-reset token shown once for
  out-of-band delivery. Persist only a cryptographic hash; consume atomically,
  update password hash, and invalidate old sessions.
- No email sent. Existing credentials, roles, and registration behavior remain
  compatible.
- New routes use `withAuth`; tests cover ownership, privilege escalation,
  account state, reset expiry/replay, and password updates.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Authenticated users can update their own display name and allowed contact
  fields; email changes enforce uniqueness. Role and other accounts cannot
  be changed.
- Admin can deactivate/reactivate accounts. Deactivated users cannot sign in
  or use existing sessions according to documented invalidation policy;
  ticket and audit history remain intact.
- Admin can issue a one-time, expiring password-reset token shown once for
  out-of-band delivery. Store only a cryptographic hash; consume atomically,
  update password hash, and invalidate old sessions.
- No email is sent. Existing credentials, roles, and registration behavior
  remain compatible.
- New routes use `withAuth`; tests cover ownership, privilege escalation,
  account state, reset expiry/replay, and password updates.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
None.

---

## Dependencies

- **Blocked by / related ids:** none
- **Depends on code areas or other stories:** Stories 01, 03, 04, 06, and 09.
  Reuse Auth.js credentials, user, and audit models. Complete Story 21 before
  moving lifecycle controls beyond admins.

## Extra notes (optional)

Password recovery is admin-mediated and out-of-band; no email verification
claim.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Email delivery, self-service email reset, MFA, SSO, or account hard delete
  - Automatic reassignment of historical ticket ownership
