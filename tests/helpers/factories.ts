import { getApp, getPrisma } from './setup';

export async function createUser(email = 'user@example.com', password = 'password123') {
  const response = await getApp().inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password },
  });
  const body = response.json() as { details: { user: { id: string; email: string } } };
  return { ...body.details.user, password };
}

export async function login(email = 'user@example.com', password = 'password123'): Promise<string> {
  const response = await getApp().inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  const body = response.json() as { details: { accessToken: string } };
  return body.details.accessToken;
}

export async function createOrg(name = 'Org', ownerId?: string) {
  const prisma = getPrisma() as unknown as {
    organization: { create(args: unknown): Promise<{ id: string; name: string }> };
  };
  const organization = await prisma.organization.create({
    data: { name, createdById: ownerId ?? '' },
  });
  return organization;
}

export async function addMember(orgId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const prisma = getPrisma() as unknown as {
    membership: { create(args: unknown): Promise<{ id: string }> };
  };
  return prisma.membership.create({ data: { organizationId: orgId, userId, role } });
}

export async function createProject(orgId: string, createdById: string, name = 'Project') {
  const prisma = getPrisma() as unknown as {
    project: { create(args: unknown): Promise<{ id: string }> };
  };
  return prisma.project.create({
    data: { organizationId: orgId, createdById, name },
  });
}

export async function createTask(
  orgId: string,
  projectId: string,
  createdById: string,
  title = 'Task',
) {
  const prisma = getPrisma() as unknown as {
    task: { create(args: unknown): Promise<{ id: string }> };
  };
  return prisma.task.create({
    data: { organizationId: orgId, projectId, createdById, title },
  });
}

export function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

export async function seedTwoTenants() {
  const ownerA = await createUser('ownerA@example.com');
  const ownerB = await createUser('ownerB@example.com');
  const orgAResponse = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(await login('ownerA@example.com')),
    payload: { name: 'Org A' },
  });
  const orgBResponse = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(await login('ownerB@example.com')),
    payload: { name: 'Org B' },
  });
  const orgA = (orgAResponse.json() as { details: { organization: { id: string } } }).details.organization;
  const orgB = (orgBResponse.json() as { details: { organization: { id: string } } }).details.organization;
  const projectB = await createProject(orgB.id, ownerB.id, 'Org B project');
  const taskB = await createTask(orgB.id, projectB.id, ownerB.id, 'Org B task');
  return {
    ownerA,
    ownerB,
    orgA,
    orgB,
    projectB,
    taskB,
    tokenA: await login('ownerA@example.com'),
    tokenB: await login('ownerB@example.com'),
  };
}
