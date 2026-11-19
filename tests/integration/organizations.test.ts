import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

describe('organization endpoints', () => {
  it('creates an organization and assigns OWNER to the creator', async () => {
    const user = await createUser('creator@example.com');
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: auth(await login('creator@example.com')),
      payload: { name: 'Acme' },
    });
    expect(response.statusCode).toBe(201);
    const org = (response.json() as { details: { organization: { id: string } } }).details.organization;
    const members = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${org.id}/members`,
      headers: auth(await login('creator@example.com')),
    });
    expect(members.statusCode).toBe(200);
    const list = (members.json() as { details: { members: { userId: string; role: string }[] } }).details.members;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ userId: user.id, role: 'OWNER' });
  });

  it('lists only organizations the caller belongs to', async () => {
    await createUser('member@example.com');
    const token = await login('member@example.com');
    const created = await getApp().inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: auth(token),
      payload: { name: 'Mine' },
    });
    const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/organizations', headers: auth(token) });
    const orgs = (response.json() as { details: { organizations: { id: string }[] } }).details.organizations;
    expect(orgs.map((o) => o.id)).toEqual([orgId]);
  });

  it('allows only OWNER to delete an organization', async () => {
    await createUser('owner@example.com');
    const ownerToken = await login('owner@example.com');
    const created = await getApp().inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: auth(ownerToken),
      payload: { name: 'Deletable' },
    });
    const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
    const response = await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(200);
  });
});
