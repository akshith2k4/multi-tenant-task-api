import type { FastifyPluginAsync } from 'fastify';
import { created, ok } from '../../lib/envelope';
import { notFound } from '../../lib/errors';
import { CreateOrganizationBody, type CreateOrganizationInput } from './schemas';
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
} from './service';

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/organizations',
    { schema: { body: CreateOrganizationBody } },
    async (request, reply) => {
      const { name } = request.body as CreateOrganizationInput;
      const org = await createOrganization(request.user!.id, name);
      return reply.code(201).send(created({ organization: org }));
    },
  );

  app.get('/organizations', async (request) =>
    ok({ organizations: await listOrganizations(request.user!.id) }),
  );

  app.get(
    '/organizations/:orgId',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const org = await getOrganization(request.ctx!.orgId);
      if (!org) throw notFound();
      return ok({ organization: org });
    },
  );

  app.delete(
    '/organizations/:orgId',
    { config: { tenant: true, permission: 'owner' } },
    async (request) => {
      await deleteOrganization(request.ctx!.orgId);
      return ok({ deleted: true });
    },
  );
};
