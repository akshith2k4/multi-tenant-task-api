import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../lib/db';
import { notFound } from '../lib/errors';
import { tenantStorage } from '../lib/tenant-db';
import type { Role } from '../types/enums';

export const tenantGuard: FastifyPluginAsync = fp(async (app) => {
  app.addHook('preHandler', async (request) => {
    if (!request.routeOptions.config?.tenant) return;
    const userId = request.user?.id;
    if (!userId) throw notFound();

    const params = request.params as Record<string, string | undefined>;
    let orgId = params['orgId'];

    if (!orgId) {
      const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      });
      const orgIds = memberships.map((m) => m.organizationId);
      if (params['projectId']) {
        const project = await prisma.project.findFirst({
          where: { id: params['projectId'], organizationId: { in: orgIds } },
          select: { organizationId: true },
        });
        orgId = project?.organizationId;
      } else if (params['taskId']) {
        const task = await prisma.task.findFirst({
          where: { id: params['taskId'], organizationId: { in: orgIds } },
          select: { organizationId: true },
        });
        orgId = task?.organizationId;
      }
    }

    if (!orgId) throw notFound();
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true },
    });
    if (!membership) throw notFound();

    const ctx = { orgId, userId, role: membership.role as Role };
    request.ctx = ctx;
    tenantStorage.enterWith(ctx);
  });
});

export function isOwnerOrAdminRole(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
