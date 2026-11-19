import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from '../config';
import { prisma } from './db';
import { AppError } from './errors';

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const TENANT_MODELS = new Set([
  'Membership',
  'Project',
  'Task',
  'AuditLog',
  'WebhookEndpoint',
  'WebhookDelivery',
]);

function context(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new AppError(500, 'INTERNAL_ERROR', 'Tenant context is missing');
  return ctx;
}

function scopedArgs(operation: string, args: Record<string, unknown>, orgId: string) {
  const result: Record<string, unknown> = { ...args };
  const where = result['where'];
  if (where !== undefined) {
    result['where'] = { ...(where as object), organizationId: orgId };
  } else if (operation.startsWith('update') || operation.startsWith('delete') || operation === 'findFirst') {
    result['where'] = { organizationId: orgId };
  }
  const data = result['data'];
  if (data !== undefined) {
    result['data'] = Array.isArray(data)
      ? data.map((item) => ({ ...(item as object), organizationId: orgId }))
      : { ...(data as object), organizationId: orgId };
  }
  return result;
}

export const tenantPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) return query(args);
        const orgId = context().orgId;
        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          throw new AppError(
            500,
            'INTERNAL_ERROR',
            'findUnique is forbidden on tenant models; use findFirst',
          );
        }
        return query(scopedArgs(operation, args as Record<string, unknown>, orgId) as never);
      },
    },
  },
});
