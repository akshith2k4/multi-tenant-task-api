# Implementation Plan: Multi-Tenant Project & Task Management API

**Branch**: `001-multi-tenant-task-api` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-multi-tenant-task-api/spec.md`

## Summary

Build an organization-scoped REST API where users register and log in, create and join
organizations, manage members with role-based permissions, and create projects and tasks within
their organizations. Every tenant-scoped query and mutation is filtered by `orgId` through a
fail-closed data-access layer; cross-organization access by known ID returns 404. Task and
project mutations write immutable audit entries in the same transaction. Background reminders
and signed webhook deliveries are idempotent, bounded, and retryable. All seven constitution
gates pass; no simplifications were rejected or deviations required.

## Technical Context

**Language/Version**: TypeScript 5.x strict (`strict`, `noImplicitAny`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`); Node.js 20 LTS
**Primary Dependencies**: Fastify, Prisma, `@prisma/client`, `pg`, `ioredis`, BullMQ, `bcrypt`,
`jose` (JWT HS256), `@sinclair/typebox` (JSON Schema), Vitest
**Storage**: PostgreSQL 15+ (primary datastore), Redis 7+ (BullMQ queues and dispatch state)
**Testing**: Vitest + Fastify `app.inject()`; dedicated `*_test` PostgreSQL and Redis DB;
serial execution with truncate-and-seed per test
**Target Platform**: Linux server/container (Node 20)
**Project Type**: web-service (REST API)
**Performance Goals**: p95 < 300ms reads, < 500ms writes; user-facing targets SC-001 and SC-005
**Constraints**: orgId on every tenant query/mutation; uniform `{ code, message, details? }`
envelope; audit entries for all task/project mutations; idempotent and retryable async work;
no cross-org data disclosure
**Scale/Scope**: 10,000 users, 1,000 organizations, up to 100 tasks per project, 50 audit entries
per page by default

All unknowns were resolved in [research.md](./research.md); no `NEEDS CLARIFICATION` markers
remain.

## Constitution Check

*GATE: Verified before Phase 0 research and re-checked after Phase 1 design.*

- [x] **I. Tenant Isolation**: `tenantPrisma` injects `organizationId` from `AsyncLocalStorage`
      into every scoped query/mutation and throws when context is absent; lint bans the raw
      client outside the DB/auth bootstrap; cross-org by known ID yields 404. See
      [Middleware Order](#middleware-order), [Data Model](#data-model).
- [x] **II. Error Envelope**: global `setErrorHandler` and `setNotFoundHandler` emit
      `{ code, message, details? }` for every response, including 404/400/403/409. See
      [contracts/openapi.yaml](./contracts/openapi.yaml).
- [x] **III. Test Coverage**: one `tests/integration/<resource>.test.ts` per endpoint and a named
      test per AC-01–AC-04; tests written to fail before implementation. See
      [Test Strategy](#test-strategy).
- [x] **IV. Audit Trail**: every task/project mutation writes an `AuditLog` row inside the same
      database transaction with actor, orgId, action, target, before/after, and timestamp.
- [x] **V. Async Work**: deterministic BullMQ job IDs plus DB compare-and-set/unique constraints
      make reminders and webhook deliveries idempotent; bounded jittered retries and DLQs make
      them retryable. See [Queue Design](#queue-design), [Retry Policy](#retry-policy).
- [x] **VI. Spec Scope**: `spec.md` contains WHAT/WHY only; all technology choices are in this
      plan and its child artifacts.
- [x] **Technology Constraints**: TypeScript strict, Fastify, Prisma, PostgreSQL, and Redis +
      BullMQ are declared in Technical Context above.

## Project Structure

```text
src/
├── server.ts                     # process entry point (listen, graceful shutdown)
├── app.ts                        # buildApp(deps) factory used by server and tests
├── config.ts                     # validated environment configuration
├── lib/
│   ├── db.ts                     # raw PrismaClient (only module allowed to import it)
│   ├── tenant-db.ts              # tenantPrisma $extends client + AsyncLocalStorage context
│   ├── errors.ts                 # AppError classes and stable error codes
│   ├── envelope.ts               # success/error envelope builders
│   └── signature.ts              # HMAC-SHA256 X-Signature helpers
├── plugins/
│   ├── auth.ts                   # JWT verification, request.user
│   ├── request-context.ts        # request id + structured logging
│   ├── queues.ts                 # BullMQ queues, workers, scheduler registration
│   └── error-handler.ts          # global error/not-found handlers
├── middleware/
│   ├── tenant-guard.ts           # resolve orgId, verify Membership, set context
│   └── rbac.ts                   # require OWNER/ADMIN/OWNER
├── modules/
│   ├── auth/                     # register, login, refresh
│   ├── organizations/            # create, list, get, delete
│   ├── members/                  # add, list, change role, remove, last-owner guard
│   ├── projects/                 # CRUD + audit
│   ├── tasks/                    # CRUD + audit + reminder enqueue
│   ├── audit/                    # paginated audit log listing
│   └── webhooks/                 # endpoint CRUD + test delivery
├── jobs/
│   ├── task-reminder.ts          # reminder worker (reminderSentAt CAS)
│   ├── webhook-delivery.ts       # signed delivery worker (PENDING→SENDING CAS)
│   └── dispatcher.ts             # periodic dispatch + stale-lease sweeper
└── types/
prisma/
├── schema.prisma
└── migrations/
tests/
├── helpers/
│   ├── factories.ts              # createUser, createOrg, addMember, createProject, createTask, login, seedTwoTenants
│   └── setup.ts                  # buildApp, truncate, seed, request helper
└── integration/
    ├── auth.test.ts
    ├── organizations.test.ts
    ├── members.test.ts
    ├── projects.test.ts
    ├── tasks.test.ts
    ├── audit.test.ts
    ├── webhooks.test.ts
    ├── tenant-isolation.test.ts
    ├── rbac-matrix.test.ts
    └── idempotency.test.ts
specs/001-multi-tenant-task-api/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/openapi.yaml
└── checklists/requirements.md
```

**Structure Decision**: Single TypeScript web-service at repository root. No frontend or mobile
app in this feature. Services are grouped by domain module; cross-cutting concerns (auth, tenant
guard, RBAC, queues, error envelope) live in dedicated `lib/`, `plugins/`, and `middleware/`
directories so they cannot be bypassed by module code.

## Data Model

Full field-level definition, constraints, enums, and relationships: [data-model.md](./data-model.md).

- **User** — unique email, bcrypt password hash; many memberships.
- **Organization** — tenant root; one or more OWNERs; deletable only by OWNER.
- **Membership** — `(organizationId, userId)` unique; role `OWNER | ADMIN | MEMBER`.
- **Project** — belongs to one organization; owns tasks; deletion cascades tasks.
- **Task** — belongs to a project and denormalized `organizationId`; strict status enum;
  optional assignee/dueDate; `reminderSentAt` idempotency marker.
- **AuditLog** — immutable, org-scoped, actor/action/target/before/after/timestamp.
- **WebhookEndpoint** — org-scoped URL, encrypted shared secret, event subscriptions.
- **WebhookDelivery** — org-scoped, unique `(endpointId, eventId)` for idempotency; status,
  attempts, nextAttemptAt, lockedAt for lease-based retries.

Tenant-bearing tables (`Project`, `Task`, `AuditLog`, `WebhookEndpoint`, `WebhookDelivery`) all
carry a non-null `organizationId`. A composite FK `Task(organizationId, projectId) →
Project(organizationId, id)` prevents cross-org task placement.

## Endpoint List

All tenant endpoints are namespaced under `/organizations/:orgId`; the tenant guard derives
`orgId` from the route and validates membership before the handler. Resource-based `orgId`
extraction is supported in the guard as a fallback for future flat routes. Full request/response
contracts: [contracts/openapi.yaml](./contracts/openapi.yaml).

| # | Method | Path | Access | Notes |
|---|--------|------|--------|-------|
| 1 | POST | `/auth/register` | public | unique email; bcrypt hash |
| 2 | POST | `/auth/login` | public | returns signed JWT |
| 3 | POST | `/auth/refresh` | public | refresh token exchange |
| 4 | POST | `/organizations` | authenticated | creator becomes OWNER |
| 5 | GET | `/organizations` | authenticated | caller's memberships only |
| 6 | GET | `/organizations/:orgId` | member | |
| 7 | DELETE | `/organizations/:orgId` | OWNER | cascades tenant data |
| 8 | POST | `/organizations/:orgId/members` | OWNER/ADMIN | AC-02 |
| 9 | GET | `/organizations/:orgId/members` | member | |
| 10 | PATCH | `/organizations/:orgId/members/:userId` | OWNER/ADMIN | AC-02; last-owner guard |
| 11 | DELETE | `/organizations/:orgId/members/:userId` | OWNER/ADMIN | last-owner guard |
| 12 | POST | `/organizations/:orgId/projects` | member | audit entry |
| 13 | GET | `/organizations/:orgId/projects` | member | |
| 14 | GET | `/organizations/:orgId/projects/:projectId` | member | |
| 15 | PATCH | `/organizations/:orgId/projects/:projectId` | member | audit entry |
| 16 | DELETE | `/organizations/:orgId/projects/:projectId` | member | cascade tasks; audit entry |
| 17 | POST | `/organizations/:orgId/projects/:projectId/tasks` | member | strict status; assignee must be member; audit entry |
| 18 | GET | `/organizations/:orgId/projects/:projectId/tasks` | member | |
| 19 | GET | `/organizations/:orgId/tasks/:taskId` | member | |
| 20 | PATCH | `/organizations/:orgId/tasks/:taskId` | member | strict status; audit entry |
| 21 | DELETE | `/organizations/:orgId/tasks/:taskId` | member | audit entry |
| 22 | GET | `/organizations/:orgId/audit-logs` | OWNER/ADMIN | 50/page, newest first |
| 23 | POST | `/organizations/:orgId/webhooks` | OWNER/ADMIN | secret returned once |
| 24 | GET | `/organizations/:orgId/webhooks` | OWNER/ADMIN | |
| 25 | PATCH | `/organizations/:orgId/webhooks/:endpointId` | OWNER/ADMIN | |
| 26 | DELETE | `/organizations/:orgId/webhooks/:endpointId` | OWNER/ADMIN | |
| 27 | POST | `/organizations/:orgId/webhooks/:endpointId/test` | OWNER/ADMIN | enqueue signed test delivery |

`GET /health` is public and checks PostgreSQL and Redis connectivity.

## Middleware Order

Fastify lifecycle, in execution order:

1. **`onRequest` — request context**: assign request id; start structured log; timers.
2. **`onRequest` — authentication** (skipped for public routes): verify JWT signature and expiry;
   load `User` by `sub`; set `request.user`. Failure → 401 `UNAUTHENTICATED`/`INVALID_TOKEN`.
3. **`preValidation` — schema validation**: TypeBox/JSON Schema validates params, query, and body.
   Invalid status → 400 `VALIDATION_ERROR` with `details.fieldErrors`; duplicate email → 409.
4. **`preHandler` — tenant guard**: read `orgId` from route param (or resolve from resource id via
   `tenantPrisma` restricted to the caller's membership orgs); verify `Membership(userId, orgId)`
   exists; set `request.ctx = { orgId, userId, role }` and enter the `AsyncLocalStorage` context.
   Missing membership, missing resource, or cross-org resource all produce the identical 404
   `RESOURCE_NOT_FOUND` — never 403.
5. **`preHandler` — RBAC**: check route permission (`member`, `owner-admin`, `owner`) against
   `request.ctx.role`. Authenticated member with insufficient role → 403 `FORBIDDEN`.
6. **handler**: call the domain service using `tenantPrisma` only; for task/project mutations,
   perform the entity write and the `AuditLog` insert in one `$transaction`.
7. **`onSend` / global error handler**: normalize every response to `{ code, message, details? }`;
   strip stack traces and SQL from details.
8. **`onResponse`**: emit metrics and finish the structured log with status and duration.

Route declarations use `config: { tenant: true, permission: 'task:write' }`. An `onRoute` hook
throws at registration time if a tenant route omits `tenant: true`, making an unguarded route a
startup failure rather than a runtime leak.

## Queue Design

| Queue | Job | Trigger | Job ID | Idempotency guard |
|-------|-----|---------|--------|-------------------|
| `task-reminders` | `send-task-reminder` | task created/updated with future `dueDate` | `reminder:<taskId>:<dueDateIso>` | CAS `UPDATE Task SET reminderSentAt=now WHERE id=? AND reminderSentAt IS NULL` |
| `webhook-delivery` | `deliver-webhook` | task/project mutation, or test endpoint | `webhook:<endpointId>:<eventId>` | unique `(endpointId, eventId)` + `PENDING→SENDING` CAS |
| `task-reminders-dlq` | — | reminder attempts exhausted | — | payload retained for inspection/replay |
| `webhook-delivery-dlq` | — | delivery attempts exhausted | — | replay re-enqueues with same `eventId` |
| scheduler (repeatable) | `dispatch-pending` | every 5s | fixed | scans `PENDING` deliveries with no live job and resets stale `SENDING` leases |
| scheduler (repeatable) | `scan-reminders` | every 5 min | fixed | re-enqueues tasks with due date within one hour and `reminderSentAt IS NULL` |

Details:

- Delayed reminder jobs fire one hour before `dueDate`; the worker CAS ensures at most one send.
- Webhook events: `task.created`, `task.updated`, `task.deleted`, `project.created`,
  `project.updated`, `project.deleted`, `task.reminder_due`.
- Mutation transaction inserts one `WebhookDelivery` row per subscribed endpoint with
  `ON CONFLICT (endpointId, eventId) DO NOTHING`; dispatch happens after commit, and the periodic
  dispatcher recovers rows lost between commit and enqueue.
- Worker claims `PENDING → SENDING` with `lockedAt` lease; on 2xx sets `DELIVERED`; a sweeper
  resets `SENDING` rows whose lease expired. Receiver dedupe on `eventId` makes any re-send safe.
- Outbound request: `POST` to endpoint URL with `X-Signature: t=<unixSeconds>,v1=<hexHmac>` where
  `hmac = HMAC-SHA256(secret, "${t}.${rawBody}")`, plus `X-Event-Id` and `X-Event-Type`. Raw body
  bytes are stored in the job payload and never re-serialized.

## Retry Policy

| Job | Attempts | Backoff | Retryable failures | Terminal action |
|-----|----------|---------|--------------------|-----------------|
| `deliver-webhook` | 5 | `min(5min, 1s * 2^n)` + full jitter | network errors, 5xx, 429 (honor `Retry-After`) | `status=DEAD`, move to `webhook-delivery-dlq` |
| `send-task-reminder` | 3 | 1s / 2s / 4s | transient errors | log error, move to `task-reminders-dlq` |
| `dispatch-pending` | 3 | fixed 5s | transient Redis/DB errors | log and retry next tick |

- Other 4xx responses are terminal on the first attempt (no wasted retries).
- All jobs use `removeOnFail: false` and bounded `removeOnComplete` for inspection.
- `lockDuration: 30s`; stalled-job detection every 15s; lease-based `lockedAt` claim prevents two
  workers from sending the same delivery.
- Replaying a DLQ item reuses the original `eventId`, so receiver idempotency still holds.
- Every handler is safe to re-run: check state before side effect, commit the state claim, then
  perform the external effect.

## Test Strategy

- **Runner**: Vitest with native TS/ESM; real Fastify app in-process via `app.inject()` — no port,
  no socket flakiness, real hooks and envelope serialization.
- **Databases**: `TEST_DATABASE_URL` (`*_test`) and `TEST_REDIS_URL` (isolated DB index).
  `beforeAll` runs `prisma migrate deploy`; `beforeEach` runs `TRUNCATE ... RESTART IDENTITY CASCADE`
  and re-seeds; Vitest serial execution prevents reset races.
- **Fixtures** (`tests/helpers/factories.ts`): `createUser`, `createOrg`, `addMember`,
  `createProject`, `createTask`, `login`, and `seedTwoTenants` (Org A and Org B each with OWNER,
  ADMIN, MEMBER, project, and task).
- **Per-endpoint tests**: one `tests/integration/<resource>.test.ts` file per resource covering
  every endpoint in the OpenAPI contract, including auth, validation, envelope, and error codes.
- **Tenant isolation** (`tenant-isolation.test.ts`): cross-org read/mutate by known ID → 404 with
  no data in the body; listing returns only membership orgs; error details never reveal the
  other org's data.
- **RBAC matrix** (`rbac-matrix.test.ts`): table-driven `it.each` over roles (OWNER/ADMIN/MEMBER/
  non-member) × actions (add member, change role, delete org, view audit, project/task mutate) with
  expected 2xx/403/404. Covers AC-02 and AC-03, plus the last-owner guard.
- **Audit tests**: every task create/update/delete and project create/update/delete produces one
  entry with actor, orgId, action, target, and before/after; audit listing defaults to 50 entries
  newest first; MEMBER cannot view the log. Covers AC-04.
- **Idempotency tests**: replaying the same webhook job twice yields one `WebhookDelivery` row and
  one HTTP send; replaying a reminder job leaves `reminderSentAt` unchanged and emits no duplicate
  event; signature helper rejects tampered bodies and stale timestamps.
- **Traceability**: AC-01–AC-04 map to named tests listed in
  [research.md §9](./research.md#9-test-strategy-and-traceability); constitution Principle III
  requires tests to fail before implementation (red-green-refactor).

## Complexity Tracking

No constitution violations. All gates pass without deviation, so no justifications are required.
The fail-closed tenant client, synchronous audit writes, and lease-based idempotency are direct
implementations of the non-negotiable principles, not exceptions to them.
