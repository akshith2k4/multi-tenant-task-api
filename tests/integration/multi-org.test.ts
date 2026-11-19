import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

describe('multi-org membership', () => {
  it('supports membership in two orgs with independent roles', async () => {
    const multi = await createUser('multi@example.com');
    await createUser('multiOwnerA@example.com');
    await createUser('multiOwnerB@example.com');

    async function createOrgFor(email: string, name: string) {
      const response = await getApp().inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: auth(await login(email)),
        payload: { name },
      });
      return (response.json() as { details: { organization: { id: string } } }).details.organization.id;
    }

    const orgA = await createOrgFor('multiOwnerA@example.com', 'A');
    const orgB = await createOrgFor('multiOwnerB@example.com', 'B');

    await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgA}/members`,
      headers: auth(await login('multiOwnerA@example.com')),
      payload: { userId: multi.id, role: 'ADMIN' },
    });
    await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgB}/members`,
      headers: auth(await login('multiOwnerB@example.com')),
      payload: { userId: multi.id, role: 'MEMBER' },
    });

    const token = await login('multi@example.com');
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/organizations', headers: auth(token) });
    const orgs = (response.json() as { details: { organizations: { id: string }[] } }).details.organizations;
    expect(orgs.map((org) => org.id).sort()).toEqual([orgA, orgB].sort());

    const denied = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgB}/audit-logs`,
      headers: auth(token),
    });
    expect(denied.statusCode).toBe(403);
    const allowed = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgA}/audit-logs`,
      headers: auth(token),
    });
    expect(allowed.statusCode).toBe(200);
  });
});
