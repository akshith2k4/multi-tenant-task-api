import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, seedTwoTenants } from '../helpers/factories';

describe('tenant isolation', () => {
  it('AC-01: cross-org resource access by known ID returns 404 and leaks no data', async () => {
    const { tokenA, orgB, projectB, taskB } = await seedTwoTenants();
    const orgResponse = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgB.id}`,
      headers: auth(tokenA),
    });
    expect(orgResponse.statusCode).toBe(404);
    expect(orgResponse.json().code).toBe('RESOURCE_NOT_FOUND');
    expect(JSON.stringify(orgResponse.json())).not.toContain('Org B');

    const projectResponse = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgB.id}/projects/${projectB.id}`,
      headers: auth(tokenA),
    });
    expect(projectResponse.statusCode).toBe(404);

    const taskResponse = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgB.id}/tasks/${taskB.id}`,
      headers: auth(tokenA),
    });
    expect(taskResponse.statusCode).toBe(404);
  });

  it('lists only projects and tasks from the caller organization', async () => {
    const { tokenA, orgA } = await seedTwoTenants();
    const response = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgA.id}/projects`,
      headers: auth(tokenA),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().details.projects).toEqual([]);
  });

  it('denies cross-org mutations with 404', async () => {
    const { tokenA, orgB, taskB } = await seedTwoTenants();
    const response = await getApp().inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgB.id}/tasks/${taskB.id}`,
      headers: auth(tokenA),
      payload: { title: 'stolen' },
    });
    expect(response.statusCode).toBe(404);
  });
});
