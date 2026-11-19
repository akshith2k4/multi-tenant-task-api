import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../lib/envelope';
import { AuditQuery, type AuditQueryInput } from './schemas';
import { listAudit } from './service';

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/organizations/:orgId/audit-logs',
    { config: { tenant: true, permission: 'owner-admin' }, schema: { querystring: AuditQuery } },
    async (request) => {
      const { page, pageSize } = (request.query ?? {}) as AuditQueryInput;
      return ok({ auditLogs: await listAudit(request.ctx!, page, pageSize) });
    },
  );
};
