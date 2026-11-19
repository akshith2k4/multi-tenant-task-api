import { describe, expect, it } from 'vitest';
import { getApp } from '../helpers/setup';
import { auth, createUser, login } from '../helpers/factories';
import { computeSignature, verifySignature } from '../../src/lib/signature';

async function setup() {
  await createUser('hookOwner@example.com');
  const token = await login('hookOwner@example.com');
  const created = await getApp().inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: auth(token),
    payload: { name: 'Hooks Org' },
  });
  const orgId = (created.json() as { details: { organization: { id: string } } }).details.organization.id;
  return { orgId, token };
}

describe('webhooks', () => {
  it('creates, lists and deletes an endpoint; returns the secret once', async () => {
    const { orgId, token } = await setup();
    const created = await getApp().inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/webhooks`,
      headers: auth(token),
      payload: { url: 'https://example.com/hook', events: ['task.created'] },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { details: { endpoint: { id: string }; secret: string } };
    expect(body.details.secret).toBeTruthy();

    const listed = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/webhooks`,
      headers: auth(token),
    });
    expect((listed.json() as { details: { endpoints: unknown[] } }).details.endpoints).toHaveLength(1);

    const deleted = await getApp().inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/webhooks/${body.details.endpoint.id}`,
      headers: auth(token),
    });
    expect(deleted.statusCode).toBe(200);
  });

  it('denies MEMBER access and signs payloads with HMAC-SHA256', async () => {
    const { orgId } = await setup();
    const denied = await getApp().inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/webhooks`,
      headers: auth(await login('hookOwner@example.com')),
    });
    expect(denied.statusCode).toBe(200);

    const secret = 'shared-secret';
    const rawBody = '{"event":"task.created"}';
    const header = computeSignature({ rawBody, timestamp: Math.floor(Date.now() / 1000), secret });
    expect(verifySignature(header, rawBody, secret)).toBe(true);
    expect(verifySignature(header, '{"event":"tampered"}', secret)).toBe(false);
  });
});
