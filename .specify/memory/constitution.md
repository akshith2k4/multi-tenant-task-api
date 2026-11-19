<!--
SYNC IMPACT REPORT
==================
Version change: UNVERSIONED TEMPLATE -> 1.0.0 (initial ratification)

Modified principles: N/A (first adoption; all principles newly defined)
  - I. Tenant Isolation (NON-NEGOTIABLE)
  - II. Consistent Error Envelope (NON-NEGOTIABLE)
  - III. Test-First with Full Acceptance Coverage (NON-NEGOTIABLE)
  - IV. Audit Trail for Mutations
  - V. Idempotent & Retryable Asynchronous Work
  - VI. Technology-Agnostic Specifications

Added sections:
  - Core Principles (six principles)
  - Technology Constraints
  - Quality Gates & Compliance Reviews
  - Governance (amendment procedure, versioning policy, compliance reviews)

Removed sections: None

Templates requiring updates:
  - UPDATED  .specify/templates/plan-template.md (Constitution Check gates made explicit)
  - UPDATED  .specify/templates/spec-template.md (WHAT/WHY-only scope constraint added)
  - UPDATED  .specify/templates/tasks-template.md (mandatory integration tests and
             tenant/error/audit/idempotency task types)
  - VERIFIED  .opencode/command/*.md (no stale agent-specific "CLAUDE" references found)
  - PENDING   Runtime guidance docs: none present (no README.md or docs/quickstart.md)

Follow-up TODOs: None.
Ratification date is set to the first-adoption date (2026-11-19) because no
prior constitution existed in this repository.
-->

# Multi-Tenant Task Management API Constitution

## Core Principles

### I. Tenant Isolation (NON-NEGOTIABLE)
Every tenant-scoped query and mutation MUST include an `orgId` filter derived
from the authenticated caller. A missing `orgId` filter is a bug, not a style
preference. No endpoint MAY return, mutate, or expose data belonging to an
organization the caller does not belong to. Tenant context MUST be propagated
to every data-access layer, including background jobs and webhook handlers.

Rationale: In a multi-tenant system, a single unscoped query can leak one
organization's data to another. Leaks are catastrophic and irreversible, so
isolation MUST be structural and provable rather than convention-based.

### II. Consistent Error Envelope (NON-NEGOTIABLE)
All responses, including errors, MUST use the envelope
`{ code, message, details? }`. `code` MUST be a stable, machine-readable
identifier; `message` MUST be human-readable; `details` MUST be optional
structured context. Responses MUST NOT expose stack traces or internal
implementation details through `details`.

Rationale: A uniform envelope lets clients handle failures predictably and
keeps internal implementation details out of the public contract.

### III. Test-First with Full Acceptance Coverage (NON-NEGOTIABLE)
Every endpoint MUST have integration tests. Each acceptance criterion in
`spec.md` MUST map to at least one test. Tests MUST be written and observed
failing before implementation begins; development MUST follow the
red-green-refactor cycle. A change with unmapped acceptance criteria or an
untested endpoint MUST NOT be merged.

Rationale: Traceability from criterion to test is what makes the contract
verifiable; writing tests first prevents tests from being shaped to match a
bug-compatible implementation.

### IV. Audit Trail for Mutations
Every mutation to a task or a project MUST produce an audit log entry. Each
entry MUST capture the actor, `orgId`, action, target entity and identifier,
timestamp, and before/after state. Audit entries MUST be durable and
queryable for compliance and incident review.

Rationale: Task and project changes are business-critical; a reliable,
queryable audit trail is required for accountability and forensics.

### V. Idempotent & Retryable Asynchronous Work
Background jobs and webhook deliveries MUST be idempotent and retryable.
Handlers MUST use stable idempotency keys and remain safe when reprocessed
after a partial failure. Retry policies MUST be bounded, use backoff, and
route exhausted attempts to a dead-letter path.

Rationale: At-least-once delivery makes duplicate execution normal. Side
effects MUST be safe to repeat so retries cannot corrupt state or double-charge.

### VI. Technology-Agnostic Specifications
`spec.md` MUST describe WHAT and WHY only. It MUST NOT name languages,
frameworks, libraries, datastores, or other technology choices. Technology
choices belong in `plan.md`. Acceptance criteria MUST be expressed in
observable, implementation-neutral terms.

Rationale: Decoupling requirements from implementation keeps the
specification stable across refactors and prevents premature technical
constraints from biasing the design.

## Technology Constraints
These choices are fixed and non-negotiable for this project. They MUST be
declared in `plan.md` and MUST NOT appear in `spec.md`:

- Language: TypeScript with strict mode enabled (`strict: true`, no implicit `any`).
- Web framework: Fastify.
- ORM / data access: Prisma.
- Primary datastore: PostgreSQL.
- Background jobs and queues: Redis with BullMQ.

Rationale: A fixed, well-understood stack reduces design churn and lets
tenant isolation, error handling, and idempotency be enforced consistently.

## Quality Gates & Compliance Reviews
- Every pull request MUST verify tenant isolation (`orgId` on all scoped
  access), conformance to the standard error envelope, and audit coverage for
  task and project mutations.
- Every endpoint change MUST include integration tests with traceability from
  each acceptance criterion to at least one test.
- New jobs and webhook handlers MUST demonstrate idempotency and retry
  behavior before merge.
- Any complexity that deviates from a principle MUST be justified in
  `plan.md` under Complexity Tracking.
- Compliance is reviewed at pull-request time and during `/speckit.analyze`;
  constitution violations are blocking findings.

## Governance
This constitution is the highest-authority document in the project and
supersedes conflicting team practices. Amendments MUST be proposed with a
written rationale, reviewed, and approved; they MUST update this file with a
semantic-version bump and a Sync Impact Report, and MUST propagate changes to
dependent templates and command files. Versioning follows MAJOR.MINOR.PATCH:
MAJOR for removals or backward-incompatible redefinitions of governance or
principles, MINOR for new or materially expanded principles or sections, and
PATCH for clarifications and non-semantic refinements. All PR reviews and
`/speckit.analyze` runs MUST check compliance; deviations MUST be justified in
writing. Runtime development guidance, if introduced, MUST remain consistent
with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-19
