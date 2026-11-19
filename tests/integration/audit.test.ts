import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

async function setup() {
  await createUser('auditOwner@example.com');
  const member = await createUser('auditMember@example.com');
  const token = await login('auditOwner@example.com');
  const created = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(token),
    payload: { name: 'Audit Org' },
  });
  const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
  await getApp().inject({
    method: 'POST',
    url: `/api/v1/organizations/${orgId}/members`,
    headers: auth(token),
    payload: { userId: member.id, role: 'MEMBER' },
  });
  await getApp().inject({
    method: 'POST',
    url: `/api/v1/organizations/${orgId}/projects`,
    headers: auth(token),
    payload: { name: 'Audited project' },
  });
  return { orgId, token };
}

describe('audit log', () => {
  it('lists entries 50 per page, newest first, for OWNER/ADMIN only', async () => {
    const { orgId, token } = await setup();
    const response = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/audit-logs`,
      headers: auth(token),
    });
    expect(response.statusCode).toBe(200);
    const result = (response.json() as { details: { auditLogs: { pageSize: number; items: { createdAt: string }[] } } }).details.auditLogs;
    expect(result.pageSize).toBe(50);
    const times = result.items.map((item) => new Date(item.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('denies MEMBER access to the audit log', async () => {
    const { orgId } = await setup();
    const response = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/audit-logs`,
      headers: auth(await login('auditMember@example.com')),
    });
    expect(response.statusCode).toBe(403);
  });
});
