import { describe, expect, it } from 'vitest';
import { getApp, getPrisma } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

async function setup() {
  await createUser('projOwner@example.com');
  const token = await login('projOwner@example.com');
  const created = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(token),
    payload: { name: 'Projects Org' },
  });
  const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
  return { token, orgId };
}

describe('project endpoints', () => {
  it('creates, lists, updates and deletes a project with audit entries', async () => {
    const { token, orgId } = await setup();
    const created = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: auth(token),
      payload: { name: 'Alpha' },
    });
    expect(created.statusCode).toBe(201);
    const projectId = (created.json() as { details: { project: { id: string } } }).details.project.id;

    const listed = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: auth(token),
    });
    expect((listed.json() as { details: { projects: unknown[] } }).details.projects).toHaveLength(1);

    const updated = await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: auth(token),
      payload: { name: 'Alpha 2' },
    });
    expect(updated.statusCode).toBe(200);

    const deleted = await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: auth(token),
    });
    expect(deleted.statusCode).toBe(200);

    const prisma = getPrisma() as unknown as {
      auditLog: { count(args: unknown): Promise<number> };
    };
    expect(await prisma.auditLog.count({ where: { organizationId: orgId } })).toBe(3);
  });

  it('cascades project deletion to tasks', async () => {
    const { token, orgId } = await setup();
    const created = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: auth(token),
      payload: { name: 'Cascade' },
    });
    const projectId = (created.json() as { details: { project: { id: string } } }).details.project.id;
    await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: auth(token),
      payload: { title: 'Child task' },
    });
    await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: auth(token),
    });
    const prisma = getPrisma() as unknown as {
      task: { count(args: unknown): Promise<number> };
    };
    expect(await prisma.task.count({ where: { organizationId: orgId } })).toBe(0);
  });
});
