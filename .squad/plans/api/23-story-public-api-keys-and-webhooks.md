# Story 23 — Public API keys and webhooks

## Prerequisites

- Stories 06, 09, and 21 completed for audit, tests, and permissions.
- Keep new `/api/v1/` contract separate from browser APIs.

---

## Story Goal

Provide scoped API credentials and signed outbound webhooks with revocation,
rate limits, durable delivery, and SSRF protections.

---

## Context — Read These Files First

1. `lib/api/http.ts` — `withAuth()` starts at line 99; versioned routes declare wrapper and then verify API key.
2. `lib/rate-limit.ts` — reuse existing rate-limit primitives and response shape.
3. `lib/activity.ts` — `logActivity()` starts at line 27; audit key and webhook lifecycle actions.
4. `prisma/schema.prisma` — `Notification` begins at line 189; add key/webhook/delivery relations without changing existing constraints.
5. `tests/api/guardrails.test.ts` — follow integration tests for per-IP limits and credential denial.

---

## Implementation tasks

### 1 — Add credential and webhook persistence

**Files: `prisma/schema.prisma`, `lib/api-keys.ts`, `prisma/migrations/`**

- Store key prefix, cryptographic hash, scopes, expiry/revocation, creator, and timestamps. Display raw key once only.
- Store HTTPS destinations, subscribed event types, encrypted signing secret, active state, and delivery attempts/status.

### 2 — Add key management and versioned endpoints

**Create files under `app/api/admin/api-keys/` and `app/api/v1/`**

- Admin routes use `withAuth({ role: "admin" })`; API-key check is additional credential.
- Enforce expiry, revocation, allowed scope, bounded rate, payload validation, and explicit response DTOs.

### 3 — Add signed durable webhook dispatch

**Files: `lib/webhooks.ts`, `app/api/admin/webhooks/`, `tests/api/webhooks.test.ts`**

- Create durable event/delivery rows; sign canonical payload with HMAC and include event id.
- Reject private, loopback, link-local, and metadata IPs after every DNS resolution; pin validated IP for connection to reduce rebinding.
- Retry bounded transient failures; record final error without secret or payload content.

### 4 — Test security boundaries

**Create file: `tests/api/api-keys.test.ts`**

- Test hash-at-rest, scopes, expiry, revocation, rate, signature, retry, and forbidden network destinations.

---

## Edge Cases & Failure Modes

- Unknown/expired/revoked key returns generic `401`; never disclose key validity details.
- Concurrent key rotation leaves old key revoked and new key visible once.
- DNS changes between validation and connect must not allow private destination.
- Webhook retry is bounded and idempotent by delivery/event id.
- No secret or full customer payload is written to logs.

---

## Test Plan

1. API-key integration tests in `tests/api/api-keys.test.ts`.
2. Webhook delivery/signature/network policy tests in `tests/api/webhooks.test.ts`.
3. Run `npm test`, lint, and build.

---

## Migration / Rollback

- Additive tables only. Encrypt signing secrets with required server key; fail startup if key configuration missing.
- On rollback revoke all API keys and pause delivery before removing storage.

---

## Verification Steps

1. **Backend builds:** Prisma validate/generate and build.
2. **Tests pass:** `npm test`.
3. **Regression:** issue scoped key, access permitted endpoint, verify forbidden scope, revoke and verify access denied.

---

## Done Criteria

- [ ] API keys are scoped, rate-limited, expiring/revocable, hashed at rest, and shown once.
- [ ] Webhooks are signed, durable, retried boundedly, and SSRF-hardened.
- [ ] API routes use `withAuth` and explicit API credential checks.
- [ ] Tests pass without vendor connector dependency.
