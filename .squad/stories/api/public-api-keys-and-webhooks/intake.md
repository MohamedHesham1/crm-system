# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/api/public-api-keys-and-webhooks/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Public API
- **Feature slug (folder under `plans/`):** `api`

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
Public API keys and webhooks
```
Provide controlled external access through scoped API keys, versioned API
routes, and administrator-configured outbound event webhooks.
---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
- Admin can create, list, revoke, and rotate API keys with explicit scopes and
  optional expiry. Raw key shown once; DB stores cryptographic hash and prefix.
- Versioned `/api/v1/` endpoints enforce key expiry, revocation, scope, and
  rate limits. Browser sessions/passwords are not API-key credentials.
- Admin can register HTTPS webhook destinations and event types. Reject
  loopback, private, link-local, and metadata-service targets at setup and
  delivery; revalidate resolved addresses to mitigate SSRF/rebinding.
- Webhooks use signed payloads, event ids, bounded retries, and durable
  idempotent delivery state.
- Routes use `withAuth`; key authentication is additional explicit auth.
  Lifecycle changes are audited; secrets never logged.
- Tests cover scope, expiry, revocation, rate limiting, signatures, retries,
  and unsafe destinations.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

- Admin can create, list, revoke, and rotate scoped API keys with optional
  expiry. Raw key is shown once; DB stores only its cryptographic hash/prefix.
- Versioned `/api/v1/` endpoints enforce expiry, revocation, scope, and rate
  limits; browser sessions and passwords are not API-key credentials.
- Admin can register HTTPS webhook destinations and event types. Reject
  unsafe network targets at setup and delivery, revalidating resolved
  addresses against SSRF/rebinding.
- Webhooks use signed payloads, event ids, bounded retries, and durable
  idempotent delivery state.
- Routes use `withAuth`; key authentication is an additional explicit check.
  Lifecycle changes are audited and secrets are never logged.
- Tests cover scope, expiry, revocation, rate limiting, signatures, retries,
  and unsafe destinations.
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
- **Depends on code areas or other stories:** Stories 06, 09, and 21. Reuse
  audit and permission contracts; versioned API remains separate from browser
  routes.

## Extra notes (optional)

Outbound delivery only to admin-configured HTTPS destinations.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Vendor-specific ERP connectors, public key signup, user-password auth, or
    WebSocket subscriptions
