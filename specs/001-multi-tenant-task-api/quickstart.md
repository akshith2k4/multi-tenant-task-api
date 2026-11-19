# Quickstart: Multi-Tenant Project & Task Management API

**Feature**: `001-multi-tenant-task-api`

## Prerequisites

- Node.js 20 LTS and npm
- PostgreSQL 15+ running locally
- Redis 7+ running locally

## Environment

Create `.env` (never commit it):

```dotenv
DATABASE_URL=postgresql://app:app@localhost:5432/taskapi
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/taskapi_test
REDIS_URL=redis://localhost:6379
TEST_REDIS_URL=redis://localhost:6379/15
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<separate-long-random-secret>
WEBHOOK_SECRET_KEY=<key-encryption-key>
PORT=3000
```

## Install and Migrate

```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
```

## Run

```bash
npm run dev          # Fastify on http://localhost:3000/api/v1
npm run typecheck    # tsc --noEmit
npm run lint         # includes no-restricted-imports guard for the raw Prisma client
```

## Run Tests

```bash
# Requires TEST_DATABASE_URL pointing at an empty *_test database.
npx prisma migrate deploy   # with DATABASE_URL=TEST_DATABASE_URL
npm test                    # Vitest, serial; truncates and seeds before each test
```

## Verify a Tenant Boundary Manually

```bash
# 1. Register and log in as a user in Org A.
curl -s -X POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"password123"}' | jq .

curl -s -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"password123"}' | jq .

# 2. Create Org A and a project in it; capture their ids from `details`.
# 3. Request Org A's project with a token belonging to Org B.
#    Expected: HTTP 404 with body {"code":"RESOURCE_NOT_FOUND","message":"Resource not found"}
curl -i -X GET localhost:3000/api/v1/organizations/<orgA>/projects/<projectA> \
  -H 'authorization: Bearer <orgB-token>'
```

## Health Check

`GET /health` returns `{"code":"OK","message":"OK","details":{"status":"ok"}}` and checks
PostgreSQL and Redis connectivity.

## Notes

- All tenant routes require `Authorization: Bearer <access-token>` and an `:orgId` path segment.
- Roles are resolved from `Membership` on every request; a role change takes effect immediately.
- Invalid task status returns 400; cross-org access always returns 404, never 403.
