# Research: Multi-Tenant Project & Task Management API

**Feature**: `001-multi-tenant-task-api` | **Date**: 2026-11-19
**Purpose**: Resolve every technical unknown and record architecture decisions.
All choices here are implementation-level; `spec.md` remains technology-agnostic.

## 1. Runtime and Language

- **Decision**: TypeScript 5.x with `strict: true`, `noImplicitAny`, `exactOptionalPropertyTypes`,
  and `noUncheckedIndexedAccess`; Node.js 20 LTS. Compile with `tsc --noEmit` in CI.
- **Rationale**: The constitution fixes TypeScript strict mode. Extra strict flags catch
  optional/undefined mistakes common in tenant-scoping code. Node 20 LTS matches Fastify 4/5
  support and provides stable `node:test`/ESM behavior.
- **Alternatives considered**: Plain JavaScript (rejected: violates constitution); Node 18
  (rejected: approaching EOL); looser TS config (rejected: weakens the tenant guard types).

## 2. JWT and Password Hashing

- **Decision**: Access token lifetime 1 hour, refresh token lifetime 7 days, both signed HS256
  with a server secret; password hashing with bcrypt cost factor 12. JWT payload carries
  `sub` (userId), `iat`, `exp`, `jti`; roles/memberships are **not** embedded and are resolved
  per request so role changes take effect immediately.
- **Rationale**: Short-lived access tokens limit exposure; refresh tokens avoid frequent
  re-login. Resolving roles per request prevents stale authorization after a role change.
  bcrypt cost 12 is a standard cost/time tradeoff.
- **Alternatives considered**: Long-lived tokens (rejected: revocation is hard); embedding roles
  in JWT (rejected: stale RBAC after role change); argon2 (rejected: user explicitly chose bcrypt).

## 3. Tenant Scoping (NON-NEGOTIABLE)

- **Decision**: Denormalize a non-null `organizationId` onto `Project` and `Task`. All tenant
  access goes through a single exported `tenantPrisma` client built with Prisma `$extends`: an
  `AsyncLocalStorage` context holds `{ orgId, userId, role }`; the extension injects
  `organizationId` into every `where`/`data`, converts `findUnique` to `findFirst`, and throws
  if context is absent. A `no-restricted-imports` lint rule bans importing the raw Prisma client
  outside `src/lib/db.ts` and auth bootstrap. Composite FK
  `Task(organizationId, projectId) → Project(organizationId, id)` prevents cross-org links.
- **Rationale**: This makes an unscoped query a hard failure instead of a convention violation,
  satisfying "a missing orgId filter is a bug". Single indexed predicate is fast and auditable.
- **Alternatives considered**: Joining `Project → Organization` on every query (rejected: slow,
  easy to forget); Prisma deprecated `$use` middleware (rejected: bypassable and not fail-closed);
  developer discipline only (rejected: not structural). PostgreSQL RLS via `app.current_org` was
  evaluated as an un-bypassable backstop and is **deferred to a hardening pass** because it adds
  per-transaction `SET LOCAL` overhead and complicates auth-only routes that list organizations;
  the fail-closed client plus lint plus guard tests are the v1 mechanism.

## 4. Middleware Order and 404 Semantics

- **Decision**: Fastify hook order: `onRequest` request-id/logging → `onRequest` JWT verify →
  `preValidation` JSON-schema validation → `preHandler` tenant guard (resolve `orgId`, verify
  Membership) → `preHandler` RBAC → handler → `onSend` envelope normalization / `onResponse`
  metrics. A global `setErrorHandler` and `setNotFoundHandler` convert all failures to the
  envelope. Cross-org, missing-resource, and no-membership cases all throw the identical
  `RESOURCE_NOT_FOUND` 404. `403 FORBIDDEN` is used only for authenticated members who fail an
  RBAC check.
- **Rationale**: Auth must precede tenant resolution; validation rejects malformed input cheaply;
  guard and RBAC run before any handler work. One generic 404 prevents existence enumeration.
- **Alternatives considered**: 403 for cross-org (rejected: confirms existence); tenant guard in
  handler (rejected: easy to omit); per-route manual checks (rejected: not centralized).

## 5. Response Envelope

- **Decision**: Every response (success and error) uses `{ code, message, details? }`. Success
  codes: `OK`, `CREATED`; `details` carries the payload (and optional pagination). Error codes:
  `UNAUTHENTICATED`, `INVALID_TOKEN`, `VALIDATION_ERROR`, `EMAIL_IN_USE`, `RESOURCE_NOT_FOUND`,
  `FORBIDDEN`, `LAST_OWNER_GUARD`, `INTERNAL_ERROR`. No stack traces or SQL are ever exposed.
- **Rationale**: Honors constitution Principle II and spec FR-018 uniformly.
- **Alternatives considered**: Raw success bodies (rejected: inconsistent with "all responses");
  separate error shape per module (rejected: clients cannot handle errors predictably).

## 6. Queue Design and Idempotency

- **Decision**: Two BullMQ queues on Redis: `task-reminders` and `webhook-delivery`, each with a
  companion DLQ. Deterministic job IDs: `reminder:<taskId>:<dueDateIso>` and
  `webhook:<endpointId>:<eventId>`. Durable DB claims gate every enqueue/send:
  `UPDATE Task SET reminderSentAt=now WHERE id=? AND reminderSentAt IS NULL RETURNING id` and
  `INSERT INTO WebhookDelivery ... ON CONFLICT (endpointId,eventId) DO NOTHING RETURNING id`.
  Webhook delivery claims rows with `PENDING → SENDING` compare-and-set plus a lease; a sweeper
  resets stale `SENDING` rows. Post-commit dispatch plus a periodic dispatcher job recovers from
  crashes between commit and enqueue.
- **Rationale**: BullMQ job IDs alone are insufficient because jobs are removed/re-added; the DB
  constraint and compare-and-set are the durable source of truth. At-least-once network delivery
  is safe because effects are idempotent.
- **Alternatives considered**: Random job IDs (rejected: duplicates on re-enqueue); distributed
  locks (rejected: lease + CAS is simpler and sufficient); transactional HTTP outbox (rejected:
  no real XA across external endpoints).

## 7. Webhook Signing

- **Decision**: HMAC-SHA256 over the exact raw bytes of the JSON body, header
  `X-Signature: t=<unixSeconds>,v1=<hexHmac>` where the signed string is `${t}.${rawBody}`.
  Also send `X-Event-Id` and `X-Event-Type`. Verification (in test helpers/receiver examples) uses
  a ±5 minute timestamp tolerance and `crypto.timingSafeEqual`.
- **Rationale**: Signing raw bytes avoids key-order/whitespace mismatches; timestamp prevents
  replay; constant-time compare prevents timing leaks.
- **Alternatives considered**: Signing re-serialized JSON (rejected: broken HMAC); unsigned
  deliveries (rejected: insecure); plain HMAC without timestamp (rejected: replayable).

## 8. Retry Policy

- **Decision**: Webhooks: 5 attempts, exponential backoff `min(5min, 1s * 2^n)` with full jitter,
  retry only network errors, 5xx, and 429 (honor `Retry-After`); other 4xx are terminal. On
  exhaustion set `WebhookDelivery.status = DEAD` and move to `webhook-delivery-dlq` with a replay
  endpoint. Reminders: 3 attempts, backoff 1s/2s/4s, then `task-reminder-dlq` and an error log;
  `reminderSentAt` stays null only if no send occurred. All jobs: `removeOnFail: false`, bounded
  `removeOnComplete`, `lockDuration` 30s, stalled-job checks every 15s.
- **Rationale**: Bounded, jittered retries contain poison events and avoid retry storms; DLQs
  preserve failed payloads for replay.
- **Alternatives considered**: Infinite retries (rejected: retry storms); retrying all 4xx
  (rejected: wasted attempts on permanent errors); dropping failures (rejected: silent loss).

## 9. Test Strategy and Traceability

- **Decision**: Vitest (native TS/ESM) driving the real Fastify app in-process via `app.inject()`.
  Dedicated `*_test` PostgreSQL database and test Redis DB. `beforeAll`: `prisma migrate deploy`;
  `beforeEach`: `TRUNCATE ... RESTART IDENTITY CASCADE` then seed; Vitest runs serially.
  `tests/helpers/factories.ts` provides `createUser`, `createOrg`, `addMember`, `createProject`,
  `createTask`, `login`, `seedTwoTenants`. RBAC is tested with a table-driven role × action matrix;
  AC-01..AC-04 have dedicated named tests.
- **Rationale**: `inject` exercises real hooks and envelope serialization without socket
  flakiness; TRUNCATE is Prisma-friendly and order-independent; a matrix plus AC tags makes the
  constitution gate auditable.
- **Alternatives considered**: Jest + supertest (rejected: extra config and a real port);
  transaction rollback (rejected: requires invasive Prisma transaction DI); mocked DB (rejected:
  tenant scoping and durable audit need a real database).

### Acceptance-Criterion → Test Traceability

| Criterion | Test file | Test name |
|-----------|-----------|-----------|
| AC-01 cross-org known ID → 404 | `tests/integration/tenant-isolation.test.ts` | `AC-01: cross-org resource access by known ID returns 404 and leaks no data` |
| AC-02 only OWNER/ADMIN add/change roles | `tests/integration/rbac-matrix.test.ts` | `AC-02: role x action matrix for member add and role change` |
| AC-03 only OWNER deletes org | `tests/integration/rbac-matrix.test.ts` | `AC-03: only OWNER can delete an organization` |
| AC-04 every task mutation audited | `tests/integration/tasks.test.ts` | `AC-04: every task mutation writes an audit entry` |

Every endpoint in `contracts/openapi.yaml` maps to a `tests/integration/<resource>.test.ts` file.

## 10. Open Questions Resolved

| Original unknown | Resolution |
|------------------|------------|
| TypeScript / Node version | TS 5.x strict, Node 20 LTS (§1) |
| Token lifetime / hashing | 1h access, 7d refresh, bcrypt cost 12 (§2) |
| Webhook signature format | `X-Signature: t=...,v1=...` over raw bytes (§7) |
| Retry counts / backoff | 5 webhook attempts, 3 reminder attempts, jittered backoff + DLQ (§8) |
| Test runner / DB reset | Vitest + `app.inject` + serial TRUNCATE on `*_test` DB (§9) |
| Scale / performance targets | 10k users, 1k orgs, 100 tasks/project; p95 < 300ms reads, < 500ms writes — implementation targets, not spec-level criteria |

No unresolved NEEDS CLARIFICATION markers remain.
