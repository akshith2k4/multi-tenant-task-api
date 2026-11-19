import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';

describe('auth endpoints', () => {
  it('registers a user with a hashed password and returns 201', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'new@example.com', password: 'password123' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code).toBe('CREATED');
    expect(body.details.user.email).toBe('new@example.com');
  });

  it('returns 409 for a duplicate email', async () => {
    await createUser('dup@example.com');
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'dup@example.com', password: 'password123' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('EMAIL_IN_USE');
  });

  it('logs in and returns a usable JWT', async () => {
    await createUser('login@example.com');
    const token = await login('login@example.com');
    const response = await getApp().inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: auth(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().code).toBe('OK');
  });

  it('rejects a wrong password with 401', async () => {
    await createUser('wrong@example.com');
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'wrong@example.com', password: 'incorrect' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a request without a token with 401', async () => {
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/organizations' });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('UNAUTHENTICATED');
  });

  it('refreshes an access token', async () => {
    await createUser('refresh@example.com');
    const loginResponse = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'refresh@example.com', password: 'password123' },
    });
    const refreshToken = (loginResponse.json() as { details: { refreshToken: string } }).details.refreshToken;
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().details.accessToken).toBeTruthy();
  });
});
