import { describe, expect, it } from 'vitest';
import { getApp, getPrisma } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

async function setup() {
  await createUser('taskOwner@example.com');
  const member = await createUser('taskMember@example.com');
  const token = await login('taskOwner@example.com');
  const created = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(token),
    payload: { name: 'Tasks Org' },
  });
  const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
  await getApp().inject({
    method: 'POST',
    url: `/api/v1/organizations/${orgId}/members`,
    headers: auth(token),
    payload: { userId: member.id, role: 'MEMBER' },
  });
  const project = await getApp().inject({
    method: 'POST',
    url: `/api/v1/organizations/${orgId}/projects`,
    headers: auth(token),
    payload: { name: 'Board' },
  });
  const projectId = (project.json() as { details: { project: { id: string } } }).details.project.id;
  return { token, orgId, projectId, member };
}

describe('task endpoints', () => {
  it('creates a task with status, assignee, and due date', async () => {
    const { token, orgId, projectId, member } = await setup();
    const response = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: auth(token),
      payload: {
        title: 'Write tests',
        status: 'IN_PROGRESS',
        assigneeId: member.id,
        dueDate: '2030-01-01T00:00:00.000Z',
      },
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { details: { task: { status: string } } }).details.task.status).toBe('IN_PROGRESS');
  });

  it('rejects an invalid status with 400', async () => {
    const { token, orgId, projectId } = await setup();
    const response = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: auth(token),
      payload: { title: 'Bad', status: 'BLOCKED' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });

  it('rejects an assignee outside the organization', async () => {
    const { token, orgId, projectId } = await setup();
    const outsider = await createUser('outsider@example.com');
    const response = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: auth(token),
      payload: { title: 'Bad assignee', assigneeId: outsider.id },
    });
    expect(response.statusCode).toBe(400);
  });

  it('AC-04: every task mutation writes an audit entry', async () => {
    const { token, orgId, projectId } = await setup();
    const created = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: auth(token),
      payload: { title: 'Audited' },
    });
    const taskId = (created.json() as { details: { task: { id: string } } }).details.task.id;
    await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/tasks/${taskId}`,
      headers: auth(token),
      payload: { status: 'DONE' },
    });
    await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/tasks/${taskId}`,
      headers: auth(token),
    });
    const prisma = getPrisma() as unknown as {
      auditLog: { findMany(args: unknown): Promise<{ action: string }[]> };
    };
    const entries = await prisma.auditLog.findMany({ where: { organizationId: orgId, targetType: 'TASK' } });
    expect(entries.map((entry) => entry.action).sort()).toEqual(['TASK_CREATE', 'TASK_DELETE', 'TASK_UPDATE']);
  });
});
