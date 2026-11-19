import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';

describe('health', () => {
  it('returns the standard envelope', async () => {
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ code: 'OK', details: { status: 'ok' } });
  });
});
