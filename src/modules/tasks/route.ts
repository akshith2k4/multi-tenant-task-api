import type { FastifyPluginAsync } from 'fastify';
import { created, ok } from '../../lib/envelope';
import { notFound } from '../../lib/errors';
import {
  CreateTaskBody,
  UpdateTaskBody,
  type CreateTaskInput,
  type UpdateTaskInput,
} from './schemas';
import { createTask, deleteTask, getTask, listTasks, updateTask } from './service';

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/organizations/:orgId/projects/:projectId/tasks',
    { config: { tenant: true, permission: 'member' }, schema: { body: CreateTaskBody } },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const task = await createTask(request.ctx!, projectId, request.body as CreateTaskInput);
      return reply.code(201).send(created({ task }));
    },
  );

  app.get(
    '/organizations/:orgId/projects/:projectId/tasks',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const { projectId } = request.params as { projectId: string };
      return ok({ tasks: await listTasks(request.ctx!, projectId) });
    },
  );

  app.get(
    '/organizations/:orgId/tasks/:taskId',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const { taskId } = request.params as { taskId: string };
      const task = await getTask(request.ctx!, taskId);
      if (!task) throw notFound();
      return ok({ task });
    },
  );

  app.patch(
    '/organizations/:orgId/tasks/:taskId',
    { config: { tenant: true, permission: 'member' }, schema: { body: UpdateTaskBody } },
    async (request) => {
      const { taskId } = request.params as { taskId: string };
      const task = await updateTask(request.ctx!, taskId, request.body as UpdateTaskInput);
      return ok({ task });
    },
  );

  app.delete(
    '/organizations/:orgId/tasks/:taskId',
    { config: { tenant: true, permission: 'member' } },
    async (request) => {
      const { taskId } = request.params as { taskId: string };
      await deleteTask(request.ctx!, taskId);
      return ok({ deleted: true });
    },
  );
};
