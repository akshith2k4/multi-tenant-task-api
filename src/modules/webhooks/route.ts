import type { FastifyPluginAsync } from 'fastify';
import { accepted, created, ok } from '../../lib/envelope';
import {
  CreateWebhookBody,
  UpdateWebhookBody,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from './schemas';
import { createEndpoint, createTestDelivery, deleteEndpoint, listEndpoints, updateEndpoint } from './service';
import { replayDeadDelivery } from './replay';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  const config = { tenant: true, permission: 'owner-admin' } as const;

  app.post(
    '/organizations/:orgId/webhooks',
    { config, schema: { body: CreateWebhookBody } },
    async (request, reply) => {
      const result = await createEndpoint(request.ctx!, request.body as CreateWebhookInput);
      return reply.code(201).send(created({ endpoint: result.endpoint, secret: result.secret }));
    },
  );

  app.get(
    '/organizations/:orgId/webhooks',
    { config },
    async (request) => ok({ endpoints: await listEndpoints(request.ctx!) }),
  );

  app.patch(
    '/organizations/:orgId/webhooks/:endpointId',
    { config, schema: { body: UpdateWebhookBody } },
    async (request) => {
      const { endpointId } = request.params as { endpointId: string };
      return ok({ endpoint: await updateEndpoint(request.ctx!, endpointId, request.body as UpdateWebhookInput) });
    },
  );

  app.delete(
    '/organizations/:orgId/webhooks/:endpointId',
    { config },
    async (request) => {
      const { endpointId } = request.params as { endpointId: string };
      await deleteEndpoint(request.ctx!, endpointId);
      return ok({ deleted: true });
    },
  );

  app.post(
    '/organizations/:orgId/webhooks/:endpointId/test',
    { config },
    async (request, reply) => {
      const { endpointId } = request.params as { endpointId: string };
      const delivery = await createTestDelivery(request.ctx!, endpointId);
      return reply.code(202).send(accepted({ delivery }));
    },
  );

  app.post(
    '/organizations/:orgId/webhooks/deliveries/:deliveryId/replay',
    { config },
    async (request) => {
      const { deliveryId } = request.params as { deliveryId: string };
      return ok({ delivery: await replayDeadDelivery(request.ctx!.orgId, deliveryId) });
    },
  );
};
