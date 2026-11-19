---
description: "Task list for the multi-tenant project and task management API"
---

# Tasks: Multi-Tenant Project & Task Management API

**Input**: Design documents from `/specs/001-multi-tenant-task-api/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Integration tests are MANDATORY for every endpoint, and each acceptance criterion in `spec.md` MUST map to at least one test (constitution Principle III). Test tasks are listed FIRST in each user story phase and MUST fail before implementation begins.

**Organization**: Tasks are grouped by user story in priority order (P1 stories first), enabling independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US8); setup, foundational, webhook, and polish phases carry no story label
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/`, `prisma/` at repository root (per plan.md)
- All paths below are concrete paths from `plan.md` — no option labels

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and strict TypeScript configuration

- [X] T001 Initialize the TypeScript project with strict compiler flags and Node 20 scripts in `package.json` and `tsconfig.json`
- [X] T002 [P] Create the Fastify app skeleton with a `buildApp` factory and server entry point in `src/app.ts` and `src/server.ts`
- [X] T003 [P] Configure Prisma client generation and PostgreSQL connection in `prisma/schema.prisma` and `src/lib/db.ts`
- [X] T004 [P] Add ESLint with `no-restricted-imports` banning the raw Prisma client outside the DB module in `.eslintrc.cjs`
- [X] T005 [P] Configure Vitest for serial execution with test database scripts in `vitest.config.ts` and `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Define all eight Prisma models, three enums, indexes, and the composite tenant FK in `prisma/schema.prisma`
- [X] T007 Generate and apply the initial database migration in `prisma/migrations/`
- [X] T008 [P] Implement typed environment-variable validation and config export in `src/config.ts`
- [X] T009 [P] Implement stable error codes and typed `AppError` classes in `src/lib/errors.ts`
- [X] T010 [P] Implement success/error envelope builders and global error/not-found handlers in `src/lib/envelope.ts` and `src/plugins/error-handler.ts`
- [X] T011 Implement the fail-closed `tenantPrisma` client with `AsyncLocalStorage` context injection in `src/lib/tenant-db.ts`
- [X] T012 [P] Implement request-id and structured logging hooks in `src/plugins/request-context.ts`
- [X] T013 [P] Implement JWT verification that loads the User from the token subject in `src/plugins/auth.ts`
- [X] T014 Implement tenant guard middleware that resolves `orgId` and validates Membership in `src/middleware/tenant-guard.ts`
- [X] T015 [P] Implement RBAC middleware and `onRoute` enforcement of tenant route config in `src/middleware/rbac.ts` and `src/app.ts`
- [X] T016 [P] Implement test factories and `app.inject()` setup with truncate-and-seed in `tests/helpers/factories.ts` and `tests/helpers/setup.ts`
- [X] T017 [P] Implement the transactional audit-entry helper for task and project mutations in `src/lib/audit.ts`
- [X] T018 Implement BullMQ queue, worker, and scheduler registration in `src/plugins/queues.ts`
- [X] T019 [P] Implement HMAC-SHA256 signature generation and constant-time verification in `src/lib/signature.ts`
- [X] T020 [P] Implement the public health check route in `src/modules/health/route.ts`
- [X] T021 [P] Write foundational envelope and health smoke tests in `tests/integration/health.test.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Register, Log In, and Receive a Token (Priority: P1) 🎯 MVP

**Goal**: Users register with email/password, log in, and receive a JWT usable on protected requests.

**Independent Test**: Register a new account, log in, receive a signed token, and use it on a protected request; duplicate email returns 409 and wrong password returns 401.

### Tests for User Story 1 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.**

- [X] T022 [P] [US1] Write failing integration tests for register, login, refresh, duplicate email, and wrong password in `tests/integration/auth.test.ts`

### Implementation for User Story 1

- [X] T023 [P] [US1] Define auth request/response schemas with TypeBox in `src/modules/auth/schemas.ts`
- [X] T024 [US1] Implement the user repository with bcrypt hashing and email lookup in `src/modules/auth/user.repository.ts`
- [X] T025 [US1] Implement `POST /auth/register` in `src/modules/auth/register.ts`
- [X] T026 [US1] Implement `POST /auth/login` issuing signed access and refresh tokens in `src/modules/auth/login.ts`
- [X] T027 [US1] Implement `POST /auth/refresh` in `src/modules/auth/refresh.ts`
- [X] T028 [US1] Wire auth routes into the Fastify app in `src/app.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Create an Organization and Become Its Owner (Priority: P1)

**Goal**: An authenticated user creates an organization and becomes its OWNER.

**Independent Test**: Create an organization and confirm the creator holds the OWNER membership with owner-only rights; list and detail endpoints return only that org.

### Tests for User Story 2 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.**

- [X] T029 [P] [US2] Write failing integration tests for create org, list orgs, get org, and OWNER assignment in `tests/integration/organizations.test.ts`

### Implementation for User Story 2

- [X] T030 [P] [US2] Define organization request/response schemas in `src/modules/organizations/schemas.ts`
- [X] T031 [US2] Implement organization service creating the org and OWNER membership in one transaction in `src/modules/organizations/service.ts`
- [X] T032 [US2] Implement and wire organization routes (create, list, detail) in `src/modules/organizations/route.ts` and `src/app.ts`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 7 - Org-Scoped Visibility and Cross-Org Denial (Priority: P1) 🛡️

**Goal**: Members see only their own organizations' data; cross-org access by known ID returns 404.

**Independent Test**: A member of Org A requests an Org B organization by known ID and receives 404 with no data; listing returns only Org A organizations.

### Tests for User Story 7 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.** AC-01 has a dedicated named test.

- [X] T033 [P] [US7] Write failing AC-01 tenant-isolation tests for organization-level cross-org access in `tests/integration/tenant-isolation.test.ts`

### Implementation for User Story 7

- [X] T034 [US7] Return the identical 404 envelope for missing, cross-org, and non-member resources in `src/middleware/tenant-guard.ts` and `src/lib/errors.ts`
- [X] T035 [US7] Enforce tenant config on every tenant route via the `onRoute` startup check in `src/app.ts`

**Checkpoint**: Tenant isolation is structurally enforced for organization-scoped access

---

## Phase 6: User Story 3 - Belong to Multiple Organizations (Priority: P2)

**Goal**: A user belongs to several organizations with an independent role in each.

**Independent Test**: Seed a user into Org A and Org B with different roles; verify listing returns both and acting in one org is unaffected by the role in the other.

### Tests for User Story 3 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.**

- [X] T036 [P] [US3] Write failing integration tests for multi-org membership and role independence in `tests/integration/multi-org.test.ts`

### Implementation for User Story 3

- [X] T037 [US3] Implement the membership repository supporting multiple memberships per user in `src/modules/members/repository.ts`
- [X] T038 [US3] Filter organization listing to the caller's memberships in `src/modules/organizations/service.ts`
- [X] T039 [US3] Verify the tenant guard resolves the correct org context for multi-org users in `src/middleware/tenant-guard.ts`

**Checkpoint**: Multi-org membership works with correct per-org context

---

## Phase 7: User Story 4 - OWNER/ADMIN Manage Members and Roles; Only OWNER Deletes Org (Priority: P2)

**Goal**: OWNER/ADMIN add members and change roles; only OWNER deletes an organization; the last OWNER cannot leave or downgrade.

**Independent Test**: Role × action matrix passes: OWNER/ADMIN succeed at member operations, MEMBER is denied 403, only OWNER deletes the org, and the last-OWNER downgrade returns 409.

### Tests for User Story 4 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.** AC-02 and AC-03 have dedicated named tests.

- [X] T040 [P] [US4] Write failing RBAC matrix tests for add member, change role, delete org, and last-owner guard in `tests/integration/rbac-matrix.test.ts`

### Implementation for User Story 4

- [X] T041 [P] [US4] Define member request/response schemas in `src/modules/members/schemas.ts`
- [X] T042 [US4] Implement member service with add, list, change role, remove, and last-owner guard in `src/modules/members/service.ts`
- [X] T043 [US4] Implement member routes and the OWNER-only organization delete in `src/modules/members/route.ts` and `src/modules/organizations/route.ts`
- [X] T044 [US4] Wire member routes into the Fastify app in `src/app.ts`

**Checkpoint**: RBAC boundaries are enforced and independently testable

---

## Phase 8: User Story 5 - Member Creates Projects in Their Organization (Priority: P2)

**Goal**: A member creates projects in their org; deleting a project cascades to its tasks.

**Independent Test**: A member creates a project, sees it in the org listing, deletes it, and confirms its tasks are gone and an audit entry exists.

### Tests for User Story 5 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.**

- [X] T045 [P] [US5] Write failing project integration tests for CRUD, cascade delete, audit entries, and cross-org denial in `tests/integration/projects.test.ts`

### Implementation for User Story 5

- [X] T046 [P] [US5] Define project request/response schemas in `src/modules/projects/schemas.ts`
- [X] T047 [US5] Implement org-scoped project service with transactional audit writes in `src/modules/projects/service.ts`
- [X] T048 [US5] Implement project routes (create, list, detail, update, delete) in `src/modules/projects/route.ts`
- [X] T049 [US5] Wire project routes into the Fastify app in `src/app.ts`

**Checkpoint**: Projects are fully functional and independently testable

---

## Phase 9: User Story 6 - Member Creates and Manages Tasks (Priority: P2)

**Goal**: A member creates tasks under a project, assigns them to a member, sets status and due date, and updates/deletes them.

**Independent Test**: Create a task with a valid status and org-member assignee, update it, confirm audit entries, reject an invalid status with 400, and deny cross-org task access with 404.

### Tests for User Story 6 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.** AC-04 has a dedicated named test.

- [X] T050 [P] [US6] Write failing task integration tests for CRUD, strict status 400, assignee validation, AC-04 audit, and cross-org denial in `tests/integration/tasks.test.ts`
- [X] T051 [P] [US6] Write failing cross-org project and task cases for AC-01 in `tests/integration/tenant-isolation.test.ts`

### Implementation for User Story 6

- [X] T052 [P] [US6] Define task request/response schemas with the strict status enum in `src/modules/tasks/schemas.ts`
- [X] T053 [US6] Implement org-scoped task service with membership-checked assignee and transactional audit writes in `src/modules/tasks/service.ts`
- [X] T054 [US6] Implement the delayed reminder enqueue helper with a deterministic job ID in `src/modules/tasks/reminders.ts`
- [X] T055 [US6] Implement task routes (create, list, detail, update, delete) in `src/modules/tasks/route.ts`
- [X] T056 [US6] Wire task routes into the Fastify app in `src/app.ts`
- [X] T057 [US6] Confirm all task and tenant-isolation tests transition from red to green in `tests/integration/tasks.test.ts`

**Checkpoint**: All user stories are independently functional

---

## Phase 10: User Story 8 - OWNER/ADMIN View Audit Log of Mutations (Priority: P2)

**Goal**: OWNER/ADMIN view org mutations, 50 entries per page, newest first; MEMBER is denied.

**Independent Test**: Perform task and project mutations, list the audit log as OWNER, verify 50-per-page default and newest-first order, and confirm MEMBER receives 403.

### Tests for User Story 8 (MANDATORY - constitution Principle III) ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL, then implement.**

- [X] T058 [P] [US8] Write failing audit-log tests for listing, 50-per-page default, newest-first order, and RBAC in `tests/integration/audit.test.ts`

### Implementation for User Story 8

- [X] T059 [P] [US8] Implement the audit query service with pagination in `src/modules/audit/service.ts`
- [X] T060 [US8] Implement the OWNER/ADMIN-only audit log route in `src/modules/audit/route.ts`
- [X] T061 [US8] Wire the audit route into the Fastify app in `src/app.ts`

**Checkpoint**: Audit log is queryable and RBAC-protected

---

## Phase 11: Cross-Cutting - Webhooks, Idempotency, and Retries (Constitution Principle V)

**Purpose**: Signed webhook deliveries and reminders that are idempotent, bounded, and retryable.

**Independent Test**: Replay the same webhook job twice and confirm one delivery row and one HTTP send; replay a reminder job and confirm `reminderSentAt` is unchanged and no duplicate event is emitted.

- [X] T062 [P] Write failing webhook endpoint CRUD and signature tests in `tests/integration/webhooks.test.ts`
- [X] T063 [P] Write failing idempotency and replay tests for webhooks and reminders in `tests/integration/idempotency.test.ts`
- [X] T064 [P] Define webhook request/response schemas in `src/modules/webhooks/schemas.ts`
- [X] T065 Implement the webhook endpoint service and CRUD routes in `src/modules/webhooks/service.ts` and `src/modules/webhooks/route.ts`
- [X] T066 Implement the signed delivery worker with CAS claim, retry, and status transitions in `src/jobs/webhook-delivery.ts`
- [X] T067 Implement the reminder worker with `reminderSentAt` compare-and-set in `src/jobs/task-reminder.ts`
- [X] T068 Implement the dispatcher, stale-lease sweeper, and DLQ replay in `src/jobs/dispatcher.ts` and `src/modules/webhooks/replay.ts`
- [X] T069 Wire webhook routes into the Fastify app in `src/app.ts`

**Checkpoint**: Asynchronous work is idempotent, retryable, and covered by tests

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, contract alignment, and hardening

- [X] T070 [P] Reconcile route implementations with the published contract in `specs/001-multi-tenant-task-api/contracts/openapi.yaml`
- [X] T071 [P] Fix TypeScript strict and lint violations across `src/` and `tests/`
- [X] T072 Run the full integration suite against the test database in `tests/integration/`
- [X] T073 [P] Verify no raw Prisma client imports or unscoped tenant queries remain in `src/lib/` and `src/modules/`
- [X] T074 [P] Record final AC-to-test traceability in `specs/001-multi-tenant-task-api/research.md`
- [X] T075 [P] Run performance smoke checks against p95 targets in `tests/integration/performance.test.ts`
- [X] T076 Validate all quickstart commands end to end in `specs/001-multi-tenant-task-api/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–10)**: All depend on Foundational completion
- **Webhooks (Phase 11)**: Depends on Foundational; task/project mutation events from US5/US6
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no other story dependencies; authentication prerequisite
- **US2 (P1)**: After US1 — needs a logged-in user to create an organization
- **US7 (P1)**: After US2 — organization-level isolation; project/task cases added in US6
- **US3 (P2)**: After US2 — needs organizations and memberships
- **US4 (P2)**: After US3 — uses the membership repository established there
- **US5 (P2)**: After US4 — project CRUD relies on org membership and RBAC conventions
- **US6 (P2)**: After US5 — tasks require a project; adds cross-org task cases for US7
- **US8 (P2)**: After US5 and US6 — audit log verifies mutations from both stories

### Within Each User Story

- Tests MUST be written and observed FAILING before implementation (constitution Principle III)
- Schemas before services; services before routes; routes before app wiring
- Story complete before moving to the next priority, unless staffing allows parallel work

### Parallel Opportunities

- Setup and Foundational tasks marked [P] run in parallel within their phases
- All test-writing tasks for a story marked [P] can run in parallel (distinct files)
- Schema tasks marked [P] can run in parallel with test-writing tasks
- US3 and US7 can be worked on in parallel after US2 if staffed
- US5 and US4 can overlap once US3 establishes the membership repository
- Phase 12 verification tasks marked [P] run in parallel

### Parallel Example: User Story 1

```bash
# Launch failing auth tests and schemas together:
Task: "T022 [P] [US1] Write failing integration tests in tests/integration/auth.test.ts"
Task: "T023 [P] [US1] Define auth schemas in src/modules/auth/schemas.ts"

# Then implement the repository, then the three routes in order:
Task: "T024 [US1] Implement user repository in src/modules/auth/user.repository.ts"
```

### Parallel Example: User Story 6

```bash
# Launch both test files together (distinct files, no dependencies):
Task: "T050 [P] [US6] Write failing task tests in tests/integration/tasks.test.ts"
Task: "T051 [P] [US6] Write failing cross-org cases in tests/integration/tenant-isolation.test.ts"
Task: "T052 [P] [US6] Define task schemas in src/modules/tasks/schemas.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — authentication
4. Complete Phase 4: US2 — organizations and OWNER assignment
5. **STOP and VALIDATE**: run `tests/integration/auth.test.ts`, `organizations.test.ts`, and
   `tenant-isolation.test.ts` independently; demo register → login → create org

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test → demo (MVP with auth)
3. US2 → test → demo (MVP: authenticated org creation)
4. US7 → test → demo (tenant isolation guaranteed)
5. US3, US4, US5, US6, US8 → each independently tested and demoed
6. Phase 11 → test idempotency → Phase 12 → polish

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: US1 → US2 → US7 (auth, orgs, isolation)
- Developer B: US3 → US4 (memberships and RBAC)
- Developer C: US5 → US6 → US8 (projects, tasks, audit)
- Developer D: Phase 11 webhooks/idempotency against the shared queue infrastructure

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] labels map tasks to spec.md user stories for traceability; cross-cutting phases are unlabeled
- Every endpoint in `contracts/openapi.yaml` is covered by a test task
- AC-01 → T033/T050/T051; AC-02 → T040; AC-03 → T040; AC-04 → T050
- Commit after each task or logical group; stop at each checkpoint to validate independently
