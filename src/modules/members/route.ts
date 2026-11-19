import type { FastifyPluginAsync } from 'fastify';
import { created, ok } from '../../lib/envelope';
import { AddMemberBody, UpdateRoleBody, type AddMemberInput, type UpdateRoleInput } from './schemas';
import { addMember, changeRole, getMembers, removeMember } from './service';

export const memberRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/organizations/:orgId/members',
    { config: { tenant: true, permission: 'owner-admin' }, schema: { body: AddMemberBody } },
    async (request, reply) => {
      const { userId, role } = request.body as AddMemberInput;
      const membership = await addMember(request.ctx!.orgId, userId, role);
      return reply.code(201).send(created({ membership }));
    },
  );

  app.get(
    '/organizations/:orgId/members',
    { config: { tenant: true, permission: 'member' } },
    async (request) => ok({ members: await getMembers(request.ctx!.orgId) }),
  );

  app.patch(
    '/organizations/:orgId/members/:userId',
    { config: { tenant: true, permission: 'owner-admin' }, schema: { body: UpdateRoleBody } },
    async (request) => {
      const params = request.params as { orgId: string; userId: string };
      const { role } = request.body as UpdateRoleInput;
      const membership = await changeRole(params.orgId, params.userId, role);
      return ok({ membership });
    },
  );

  app.delete(
    '/organizations/:orgId/members/:userId',
    { config: { tenant: true, permission: 'owner-admin' } },
    async (request) => {
      const params = request.params as { orgId: string; userId: string };
      await removeMember(params.orgId, params.userId);
      return ok({ removed: true });
    },
  );
};
