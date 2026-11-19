import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/db';
import { ok } from '../../lib/envelope';
import { redisConnection } from '../../plugins/queues';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', { config: { public: true } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    const redis = redisConnection();
    if (redis.status !== 'ready') {
      try {
        await redis.connect();
      } catch {
        // already connecting
      }
    }
    return ok({ status: 'ok' });
  });
};
