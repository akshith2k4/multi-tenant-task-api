import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

async function setupOrg() {
  const owner = await createUser('matrixOwner@example.com');
  const member = await createUser('matrixMember@example.com');
  const admin = await createUser('matrixAdmin@example.com');
  const ownerToken = await login('matrixOwner@example.com');
  const created = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(ownerToken),
    payload: { name: 'Matrix' },
  });
  const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
  for (const [userId, role] of [
    [member.id, 'MEMBER'],
    [admin.id, 'ADMIN'],
  ] as const) {
    await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/members`,
      headers: auth(ownerToken),
      payload: { userId, role },
    });
  }
  return { owner, member, admin, orgId };
}

describe('RBAC matrix', () => {
  const cases = [
    ['OWNER', 'matrixOwner@example.com', 201],
    ['ADMIN', 'matrixAdmin@example.com', 201],
    ['MEMBER', 'matrixMember@example.com', 403],
  ] as const;

  it.each(cases)('AC-02: %s adding a member returns %i', async (_role, email, expected) => {
    const { orgId } = await setupOrg();
    const target = await createUser('target@example.com');
    const response = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/members`,
      headers: auth(await login(email)),
      payload: { userId: target.id, role: 'MEMBER' },
    });
    expect(response.statusCode).toBe(expected);
  });

  it.each([
    ['OWNER', 'matrixOwner@example.com', 200],
    ['ADMIN', 'matrixAdmin@example.com', 403],
    ['MEMBER', 'matrixMember@example.com', 403],
  ] as const)('AC-03: %s deleting the org returns %i', async (_role, email, expected) => {
    const { orgId } = await setupOrg();
    const response = await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}`,
      headers: auth(await login(email)),
    });
    expect(response.statusCode).toBe(expected);
  });

  it('blocks downgrading the last OWNER with 409', async () => {
    const { owner, orgId } = await setupOrg();
    const response = await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/members/${owner.id}`,
      headers: auth(await login('matrixOwner@example.com')),
      payload: { role: 'MEMBER' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('LAST_OWNER_GUARD');
  });
});
