import type { TenantContext } from '../../config';
import { prisma } from '../../lib/db';

export async function listAudit(ctx: TenantContext, page = 1, pageSize = 50) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const where = { organizationId: ctx.orgId };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: safePage, pageSize: safeSize };
}
