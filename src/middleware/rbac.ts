import type { Role } from '../types/enums';
import { forbidden, notFound } from '../lib/errors';

export function isOwnerOrAdmin(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export const rbac = (...allowed: Role[]) => {
  return async (request: { ctx?: { role: Role } }) => {
    if (!request.ctx || !allowed.includes(request.ctx.role)) throw forbidden();
  };
};

export const requireRole = (permission: 'member' | 'owner-admin' | 'owner' | undefined) => {
  return async (request: { ctx?: { role: Role } }) => {
    const role = request.ctx?.role;
    if (!role) throw notFound();
    if (permission === 'owner' && role !== 'OWNER') throw forbidden();
    if (permission === 'owner-admin' && !isOwnerOrAdmin(role)) throw forbidden();
  };
};
