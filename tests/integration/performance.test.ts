import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

describe('performance smoke', () => {
  it('keeps a tenant-scoped listing under 300ms p95 for a small dataset', async () => {
    await createUser('perf@example.com');
    const token = await login('perf@example.com');
    const created = await getApp().inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: auth(token),
      payload: { name: 'Perf' },
    });
    const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
    const durations: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const start = performance.now();
      const response = await getApp().inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: auth(token),
      });
      durations.push(performance.now() - start);
      expect(response.statusCode).toBe(200);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    expect(p95).toBeLessThan(300);
  });
});
