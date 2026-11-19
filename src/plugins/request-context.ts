import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export const requestContextPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (request) => {
    request.id = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      { requestId: request.id, statusCode: reply.statusCode, url: request.url },
      'request completed',
    );
  });
});
