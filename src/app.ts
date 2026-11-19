import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config';
import { errorHandlerPlugin } from './plugins/error-handler';
import { requestContextPlugin } from './plugins/request-context';
import { authPlugin } from './plugins/auth';
import { tenantGuard } from './middleware/tenant-guard';
import { requireRole } from './middleware/rbac';
import { healthRoutes } from './modules/health/route';
import { authRoutes } from './modules/auth/route';
import { organizationRoutes } from './modules/organizations/route';
import { memberRoutes } from './modules/members/route';
import { projectRoutes } from './modules/projects/route';
import { taskRoutes } from './modules/tasks/route';
import { auditRoutes } from './modules/audit/route';
import { webhookRoutes } from './modules/webhooks/route';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.isTest ? false : true });

  app.addHook('onRoute', (route) => {
    if (route.url.includes(':orgId') && route.config?.tenant !== true) {
      throw new Error(`Tenant route ${route.url} is missing config.tenant = true`);
    }
  });

  await app.register(errorHandlerPlugin);
  await app.register(requestContextPlugin);
  await app.register(authPlugin);
  await app.register(tenantGuard);

  app.addHook('preHandler', async (request) => {
    const permission = request.routeOptions.config?.permission;
    if (permission) await requireRole(permission)(request);
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(organizationRoutes, { prefix: '/api/v1' });
  await app.register(memberRoutes, { prefix: '/api/v1' });
  await app.register(projectRoutes, { prefix: '/api/v1' });
  await app.register(taskRoutes, { prefix: '/api/v1' });
  await app.register(auditRoutes, { prefix: '/api/v1' });
  await app.register(webhookRoutes, { prefix: '/api/v1' });

  return app;
}
