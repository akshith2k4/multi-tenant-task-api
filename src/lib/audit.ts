import type { Tx } from './db';
import type { TenantContext } from '../config';

export interface AuditInput {
  actorId: string;
  action: string;
  targetType: 'TASK' | 'PROJECT';
  targetId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(tx: Tx, ctx: TenantContext, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: ctx.orgId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.before === undefined ? {} : { before: input.before as object }),
      ...(input.after === undefined ? {} : { after: input.after as object }),
    },
  });
}
