import type { FastifyPluginAsync } from 'fastify';
import { created, ok } from '../../lib/envelope';
import { notFound } from '../../lib/errors';
import {
  CreateProjectBody,
  UpdateProjectBody,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './schemas';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './service';

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/organizations/:orgId/projects',
    { config: { tenant: true, permission: 'member' }, schema: { body: CreateProjectBody } },
    async (request, reply) => {
      const { name, description } = request.body as CreateProjectInput;
      const project = await createProject(request.ctx!, name, description);
      return reply.code(201).send(created({ project }));
    },
  );

  app.get(
    '/organizations/:orgId/projects',
    { config: { tenant: true, permission: 'member' } },
    async (request) => ok({ projects: await listProjects(request.ctx!) }),
  );

  app.get(
    '/organizations/:orgId/projects/:projectId',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const { projectId } = request.params as { projectId: string };
      const project = await getProject(request.ctx!, projectId);
      if (!project) throw notFound();
      return ok({ project });
    },
  );

  app.patch(
    '/organizations/:orgId/projects/:projectId',
    { config: { tenant: true, permission: 'member' }, schema: { body: UpdateProjectBody } },
    async (request) => {
      const { projectId } = request.params as { projectId: string };
      const project = await updateProject(request.ctx!, projectId, request.body as UpdateProjectInput);
      return ok({ project });
    },
  );

  app.delete(
    '/organizations/:orgId/projects/:projectId',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const { projectId } = request.params as { projectId: string };
      await deleteProject(request.ctx!, projectId);
      return ok({ deleted: true });
    },
  );
};
