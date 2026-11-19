# Feature Specification: Multi-Tenant Project & Task Management API

**Feature Branch**: `001-multi-tenant-task-api`  
**Created**: 2026-11-19  
**Status**: Draft  
**Input**: User description: "Build a multi-tenant Project & Task Management API with
organization-scoped projects and tasks, role-based administration, tenant isolation,
and an audit log of mutations."

> **Scope discipline (constitution Principle VI)**: This specification captures
> WHAT and WHY only. It MUST NOT name languages, frameworks, libraries,
> datastores, or other technology choices. Those belong in `plan.md`.

## Clarifications

### Session 2026-11-19

- Q: What happens when the last remaining OWNER leaves or downgrades their role? → A: Block the action until ownership is transferred to another member.
- Q: What task status values are allowed and how are invalid values handled? → A: Exactly TODO, IN_PROGRESS, DONE; reject any other value with 400 Bad Request.
- Q: What happens to tasks when their project is deleted? → A: Cascade the delete so all tasks under the project are deleted.
- Q: For AC-01 cross-org resource requests, which response should be returned? → A: Always 404 Not Found, never 403, so resource existence is not leaked.
- Q: What are the default pagination rules for the audit log? → A: 50 entries per page by default, sorted newest first.

## User Scenarios & Testing *(mandatory)*

The following user journeys are ordered by priority. Each is independently
testable and delivers value on its own.

### User Story 1 - Register, Log In, and Receive a Token (Priority: P1)

As a user, I can register with an email and password and log in to receive a JWT,
so I can act as an authenticated member of organizations.

**Why this priority**: Authentication is a prerequisite for every other capability;
without it, no tenant-scoped or role-based behavior can be exercised.

**Independent Test**: Register a new user, log in with those credentials, confirm a
token is returned, and confirm the token is accepted on a subsequent protected
request.

**Acceptance Scenarios**:

1. **Given** no account exists for an email, **When** the user registers with that
   email and a password, **Then** the account is created and the user can log in.
2. **Given** a registered user, **When** they log in with correct credentials,
   **Then** they receive a JWT usable for protected requests.
3. **Given** a registered user, **When** they log in with an incorrect password,
   **Then** access is denied and no token is issued.

---

### User Story 2 - Create an Organization and Become Its Owner (Priority: P1)

As a user, I can create an organization and automatically become its OWNER, so I
can administer a tenant.

**Why this priority**: This establishes the tenant boundary that all org-scoped
behavior depends on.

**Independent Test**: A registered user creates an organization and is recorded as
its OWNER with the associated administrative rights.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they create an organization, **Then**
   the organization exists and the creator holds the OWNER role within it.
2. **Given** a newly created organization, **When** the OWNER performs an
   owner-only action (for example, deleting the organization), **Then** the action
   is permitted.

---

### User Story 3 - Belong to Multiple Organizations (Priority: P2)

As a user, I can be a member of several organizations at once, each with its own
role, so I can work across teams without maintaining separate accounts.

**Why this priority**: Multi-tenancy for users is core to the product; without it a
user would need duplicate accounts per organization.

**Independent Test**: A user joins a second organization and can act within each
organization according to that organization's data and role.

**Acceptance Scenarios**:

1. **Given** a user is a MEMBER of Org A, **When** they are added to Org B with a
   role, **Then** they belong to both with roles stored independently.
2. **Given** a user belongs to Org A and Org B, **When** they act within one
   organization, **Then** their role in the other organization has no effect.

---

### User Story 4 - OWNER/ADMIN Manage Members and Roles; Only OWNER Deletes Org (Priority: P2)

As an OWNER or ADMIN, I can add members and assign roles in my organization, and as
OWNER I can delete the organization, so administration stays controlled.

**Why this priority**: Role-based administration protects tenant data and directly
enforces the explicit authorization acceptance criteria.

**Independent Test**: An ADMIN adds a member and changes a role, a MEMBER is denied
the same actions, and only an OWNER can delete the organization.

**Acceptance Scenarios**:

1. **Given** an OWNER or ADMIN of an org, **When** they add a user and assign a role
   (OWNER, ADMIN, or MEMBER), **Then** the user is added with that role.
2. **Given** a MEMBER of an org, **When** they attempt to add a member or change a
   role, **Then** the action is denied.
3. **Given** an OWNER of an org, **When** they delete the organization, **Then** the
   organization and its contained data are removed.
4. **Given** an ADMIN of an org, **When** they attempt to delete the organization,
   **Then** the action is denied.
5. **Given** an org with exactly one OWNER, **When** that OWNER attempts to leave
   or downgrade their role, **Then** the action is blocked until ownership is
   transferred to another member.

---

### User Story 5 - Member Creates Projects in Their Organization (Priority: P2)

As a member of an org, I can create projects within that org, so work can be
organized under a tenant.

**Why this priority**: Projects are the container that tasks depend on and the unit
of tenant scoping.

**Independent Test**: A member creates a project and it is visible only within
their organization.

**Acceptance Scenarios**:

1. **Given** a MEMBER of an org, **When** they create a project in that org,
   **Then** the project exists and belongs to that org.
2. **Given** a user who is not a member of an org, **When** they attempt to create
   a project in it, **Then** the action is denied.
3. **Given** a project with tasks, **When** the project is deleted, **Then** all
   tasks under that project are also deleted.

---

### User Story 6 - Member Creates and Manages Tasks (Priority: P2)

As a member, I can create tasks under a project, assign them to a member, set a
status, and set a due date, so work is trackable.

**Why this priority**: Task management is the primary day-to-day value of the
product.

**Independent Test**: A member creates a task with an assignee, status, and due
date, then updates it; the changes are visible to members of that org.

**Acceptance Scenarios**:

1. **Given** a project in the member's org, **When** the member creates a task with
   a title, assignee, status, and due date, **Then** the task is stored with those
   attributes.
2. **Given** a task, **When** a member changes its status or due date, **Then** the
   change is reflected for members of that org.
3. **Given** a proposed assignee who is not a member of the org, **When** the task
   is assigned to them, **Then** the assignment is rejected.
4. **Given** a task create or update with a status other than `TODO`,
   `IN_PROGRESS`, or `DONE`, **When** the request is submitted, **Then** it is
   rejected with 400 Bad Request.

---

### User Story 7 - Org-Scoped Visibility and Cross-Org Denial (Priority: P1)

As a member, I can see only projects and tasks belonging to organizations I belong
to, and I cannot access another organization's resources even if I know their
identifiers.

**Why this priority**: Tenant isolation is a non-negotiable security constraint; any
leak is catastrophic and irreversible.

**Independent Test**: A member of Org A attempts to read a project and a task known
to belong to Org B and is denied, while listing returns only Org A data.

**Acceptance Scenarios**:

1. **Given** a user who is a member of Org A but not Org B, **When** they list
   projects and tasks, **Then** only Org A's projects and tasks are returned.
2. **Given** a user from Org A who knows the identifier of a resource in Org B,
   **When** they request that resource, **Then** the response is 404 Not Found and
   no Org B data is returned.
3. **Given** a user from Org A, **When** they attempt to mutate a task belonging to
   Org B, **Then** the mutation is denied and no change occurs.

---

### User Story 8 - OWNER/ADMIN View Audit Log of Mutations (Priority: P2)

As an OWNER or ADMIN, I can view an audit log of mutations in my organization, and
every task mutation is recorded, so changes are accountable.

**Why this priority**: Auditability is a non-negotiable constraint required for
compliance and incident review.

**Independent Test**: An OWNER performs task mutations and then views the audit log,
finding one entry per mutation; a MEMBER cannot view the log.

**Acceptance Scenarios**:

1. **Given** an OWNER or ADMIN of an org, **When** they view the audit log, **Then**
   they see mutation entries for that org, including task and project changes,
   50 entries per page by default, ordered newest first.
2. **Given** a task mutation, **When** it completes, **Then** an audit log entry
   recording the actor, action, target, and time is present.
3. **Given** a MEMBER of an org, **When** they attempt to view the audit log,
   **Then** access is denied.

---

### Explicit Acceptance Criteria

The following criteria are called out explicitly by the request and are covered by
the scenarios above:

1. **AC-01**: A user from Org A receives 404 Not Found when requesting a resource
   from Org B, even if they know the resource ID. (US7)
2. **AC-02**: Only OWNER and ADMIN can add members or change roles. (US4)
3. **AC-03**: Only OWNER can delete an organization. (US4)
4. **AC-04**: Every task mutation writes an audit log entry. (US8)

---

### Edge Cases

- Registration with an email address that is already in use.
- A protected request made with an invalid or expired token.
- Assigning a task to a user who is not a member of the task's organization.
- Requesting an identifier that does not exist versus one owned by another
  organization; both yield 404 Not Found so existence is not disclosed.
- Downgrading or removing the last remaining OWNER is blocked until ownership is
  transferred to another member.
- Deleting an organization that still contains projects and tasks.
- Deleting a project cascades deletion to all tasks under that project.
- Creating a task with a due date in the past.
- Setting a task status outside `TODO`, `IN_PROGRESS`, or `DONE` is rejected with
  400 Bad Request.
- High-volume audit logs are viewed 50 entries per page by default, newest first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to register with a unique email address and
  a password.
- **FR-002**: System MUST allow a registered user to log in with their email and
  password and receive a signed authentication token (JWT) on success.
- **FR-003**: System MUST require a valid authentication token for all protected
  operations and MUST deny requests with an invalid or expired token.
- **FR-004**: System MUST allow an authenticated user to create an organization and
  MUST assign the OWNER role to the creator within that organization.
- **FR-005**: System MUST allow a user to belong to multiple organizations, with a
  role stored independently for each organization.
- **FR-006**: System MUST allow only users with the OWNER or ADMIN role in an
  organization to add members to that organization.
- **FR-007**: System MUST allow only users with the OWNER or ADMIN role in an
  organization to assign or change a member's role within that organization.
- **FR-008**: System MUST allow only the OWNER role to delete an organization.
- **FR-009**: System MUST allow a member of an organization to create a project
  within that organization.
- **FR-010**: System MUST allow a member of an organization to create a task under a
  project belonging to that organization.
- **FR-011**: System MUST allow a task to be assigned only to a member of the same
  organization as the task's project.
- **FR-012**: System MUST allow a task status of exactly `TODO`, `IN_PROGRESS`, or
  `DONE`, MUST reject any other status value with 400 Bad Request, and MUST allow
  an optional due date.
- **FR-013**: System MUST scope all project and task reads to the organizations the
  caller is a member of.
- **FR-014**: System MUST return 404 Not Found when a caller requests or mutates a
  resource belonging to an organization they are not a member of, even when the
  resource identifier is known, so existence is not disclosed.
- **FR-015**: System MUST write an audit log entry for every task mutation.
- **FR-016**: System MUST write an audit log entry for every project mutation.
- **FR-017**: System MUST allow only OWNER or ADMIN roles to view the audit log for
  their organization.
- **FR-018**: System MUST return errors in a standard shape containing a code, a
  message, and optional details.
- **FR-019**: System MUST prevent any response from exposing data belonging to an
  organization the caller does not belong to.
- **FR-020**: System MUST record in each audit entry the actor, organization,
  action, target, and time of the mutation.
- **FR-021**: System MUST block an OWNER from leaving or downgrading their role in
  an organization while they are its last remaining OWNER, and MUST require
  ownership transfer to another member before the change is allowed.
- **FR-022**: System MUST delete all tasks belonging to a project when that project
  is deleted.
- **FR-023**: System MUST present audit log entries 50 per page by default, ordered
  newest first.

### Key Entities *(include if feature involves data)*

- **User**: A registered person identified by a unique email; may hold membership
  in several organizations.
- **Organization**: A tenant boundary that owns projects and members; has at least
  one OWNER, and the last OWNER cannot leave or be downgraded without transferring
  ownership; can be deleted only by an OWNER.
- **Membership**: The association of a User to an Organization with a role of
  OWNER, ADMIN, or MEMBER.
- **Project**: A container of tasks that belongs to exactly one organization;
  deleting it deletes all of its tasks.
- **Task**: A work item under a project with a title, an optional assignee (an org
  member), a status of exactly `TODO`, `IN_PROGRESS`, or `DONE`, and an optional
  due date.
- **Audit Log Entry**: An immutable record of a mutation capturing organization,
  actor, action, target, and time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can register, log in, and obtain a usable token in under
  2 minutes.
- **SC-002**: In tenant-isolation verification, zero cross-organization resources
  are disclosed; every cross-org request with a known identifier returns 404 Not
  Found.
- **SC-003**: 100% of task and project mutations have a corresponding, retrievable
  audit log entry.
- **SC-004**: 100% of role-restricted actions are denied for callers without the
  required OWNER or ADMIN role.
- **SC-005**: 95% of users can create their first organization, project, and task
  within 5 minutes without assistance.
- **SC-006**: In a post-trial survey, at least 90% of members agree their
  organization's data is visible only to that organization's members.

## Assumptions

- Email addresses are unique across the system and serve as the login identifier.
- Roles are organization-scoped: the same user may hold different roles in
  different organizations.
- Adding a member requires the invited person to already have a user account.
- The only valid task statuses are `TODO`, `IN_PROGRESS`, and `DONE`; no other
  values are accepted.
- Deleting an organization permanently removes its projects, tasks, and
  memberships; deleting a project permanently removes all of its tasks.
- Transferring ownership means assigning the OWNER role to another member of the
  organization.
- Authentication tokens have a finite lifetime and can be renewed; renewal details
  are a product default.
- Audit log entries are immutable and retained according to standard compliance
  practice.
- Email notifications and invitations are out of scope for this version.
- "Resource" in AC-01 includes organizations, projects, tasks, and audit log
  entries.
