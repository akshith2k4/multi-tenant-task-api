# Data Model: Multi-Tenant Project & Task Management API

**Feature**: `001-multi-tenant-task-api` | **Date**: 2026-11-19
**Source**: `spec.md` (Key Entities, clarifications, FR-001–FR-023)

## Enums

- `Role`: `OWNER | ADMIN | MEMBER` (organization-scoped, stored on `Membership`).
- `TaskStatus`: `TODO | IN_PROGRESS | DONE` (strict; any other value → 400).
- `WebhookStatus`: `PENDING | SENDING | DELIVERED | DEAD`.

## Entity: User

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| email | text | unique, normalized lowercase, required |
| passwordHash | text | bcrypt cost 12, required, never serialized |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Relations: `memberships`, `createdProjects`, `assignedTasks`, `auditLogs` (as actor),
`webhookEndpoints` (as creator).

Rules: email is the unique login identifier (FR-001); duplicate registration → 409
`EMAIL_IN_USE`; password stored only as hash.

## Entity: Organization

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| name | text | required, 1–200 chars |
| createdById | uuid | FK → User, required |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Relations: `memberships`, `projects`, `auditLogs`, `webhookEndpoints`.

Rules: creator receives `OWNER` membership in the same transaction (FR-004); at least one
`OWNER` must remain (FR-021); only an `OWNER` may delete (FR-008); deleting cascades memberships,
projects (and their tasks), audit logs, and webhook configuration.

## Entity: Membership

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| userId | uuid | FK → User, required |
| organizationId | uuid | FK → Organization, required |
| role | Role | required |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Constraints: `@@unique([organizationId, userId])`, `@@index([userId, organizationId])`,
`@@index([organizationId, role])`.

Rules: one role per user per org (FR-005); role changes/additions restricted to
`OWNER`/`ADMIN` (FR-006, FR-007); a downgrade/removal that would leave zero `OWNER`s is blocked
with 409 `LAST_OWNER_GUARD` (FR-021); roles are never stored on `User`.

## Entity: Project

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| organizationId | uuid | FK → Organization, required (tenant scope) |
| name | text | required, 1–200 chars |
| description | text? | optional |
| createdById | uuid | FK → User, required |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Constraints: `@@index([organizationId, createdAt])`;
composite unique `(id, organizationId)` used by the tenant FK.

Relations: `tasks`, `auditLogs`.

Rules: created only by an org member (FR-009); all reads/updates filtered by `organizationId`
(FR-013, FR-019); deletion cascades all child `Task` rows (FR-022) and writes an audit entry
(FR-016).

## Entity: Task

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| projectId | uuid | FK → Project, required |
| organizationId | uuid | FK → Organization, required (denormalized tenant scope) |
| title | text | required, 1–200 chars |
| description | text? | optional |
| status | TaskStatus | required, default `TODO` |
| assigneeId | uuid? | FK → User, nullable |
| dueDate | timestamptz? | nullable |
| reminderSentAt | timestamptz? | nullable — reminder idempotency marker |
| createdById | uuid | FK → User, required |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Constraints: composite FK `(organizationId, projectId) → Project(organizationId, id)`;
`@@index([organizationId, projectId])`, `@@index([organizationId, status])`,
`@@index([assigneeId])`, `@@index([dueDate])`.

Rules: assignee must be a member of the same organization (FR-011, 400 otherwise); status
strictly `TODO`/`IN_PROGRESS`/`DONE`, invalid → 400 `VALIDATION_ERROR` (FR-012); every mutation
writes `AuditLog` (FR-015); `reminderSentAt` is set once via compare-and-set so a reminder is
never sent twice.

State transitions: `TODO → IN_PROGRESS → DONE` is the common path; all direct transitions between
any of the three statuses are allowed — only the value set is constrained, not the sequence.

## Entity: AuditLog

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| organizationId | uuid | FK → Organization, required (tenant scope) |
| actorId | uuid | FK → User, required |
| action | text | required, e.g. `TASK_CREATE`, `TASK_UPDATE`, `TASK_DELETE`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_DELETE` |
| targetType | text | required, `TASK` or `PROJECT` |
| targetId | uuid | required |
| before | json? | previous state, nullable for creates |
| after | json? | new state, nullable for deletes |
| createdAt | timestamptz | required |

Constraints: `@@index([organizationId, createdAt])`, `@@index([organizationId, targetType, targetId])`.
No `updatedAt` — entries are immutable.

Rules: written in the **same database transaction** as the task/project mutation (FR-015,
FR-016, FR-020); visible only to `OWNER`/`ADMIN` (FR-017); listed 50 per page by default,
newest first (FR-023).

## Entity: WebhookEndpoint

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| organizationId | uuid | FK → Organization, required (tenant scope) |
| url | text | required, https URL |
| secretCiphertext | text | encrypted shared secret for HMAC-SHA256 |
| events | text[] | subscribed event types, non-empty |
| enabled | boolean | default true |
| createdById | uuid | FK → User, required |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Constraints: `@@index([organizationId, enabled])`.

Rules: manageable only by `OWNER`/`ADMIN`; secret returned only once at creation and never again;
used to sign `X-Signature` on deliveries.

## Entity: WebhookDelivery

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| organizationId | uuid | FK → Organization, required (tenant scope) |
| endpointId | uuid | FK → WebhookEndpoint, required |
| eventId | uuid | stable idempotency key, required |
| eventType | text | required |
| payload | json | required (captured raw bytes for signing) |
| status | WebhookStatus | default `PENDING` |
| attempts | int | default 0 |
| nextAttemptAt | timestamptz? | nullable, scheduled retry time |
| lockedAt | timestamptz? | nullable, worker lease |
| lastError | text? | nullable |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |

Constraints: `@@unique([endpointId, eventId])` — durable idempotency;
`@@index([status, nextAttemptAt])`, `@@index([organizationId, createdAt])`.

Rules: created once per event/endpoint via `ON CONFLICT DO NOTHING`; worker claims with
`PENDING → SENDING` CAS and lease; terminal states `DELIVERED` or `DEAD`; `DEAD` rows move to DLQ
and can be replayed with the same `eventId` (dedupe preserved).

## Relationships Summary

```
User 1──* Membership *──1 Organization
Organization 1──* Project 1──* Task
Organization 1──* AuditLog
Organization 1──* WebhookEndpoint 1──* WebhookDelivery
User 1──* Task (assignee)
User 1──* AuditLog (actor)
```

## Tenant-Scope Guarantee

`Project`, `Task`, `AuditLog`, `WebhookEndpoint`, and `WebhookDelivery` all carry a non-null
`organizationId`. Every query against them passes through `tenantPrisma`, which injects
`organizationId` from the request context and throws when context is missing. `Membership`
is the authorization source for both tenant guard and RBAC.
