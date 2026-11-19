import { prisma, Prisma } from '../../lib/db';
import { lastOwnerGuard, notFound, validationError } from '../../lib/errors';
import type { Role } from '../../types/enums';
import {
  addMembership,
  countOwners,
  findMembership,
  listMembers,
  listMemberships,
} from './repository';

export async function getMemberships(userId: string) {
  return listMemberships(userId);
}

export async function getMembers(orgId: string) {
  return listMembers(orgId);
}

export async function addMember(orgId: string, userId: string, role: Role) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) throw notFound();
  try {
    return await addMembership(orgId, userId, role);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw validationError({ field: 'userId', message: 'User is already a member' });
    }
    throw error;
  }
}

export async function changeRole(orgId: string, userId: string, role: Role) {
  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({ where: { organizationId: orgId, userId } });
    if (!membership) throw notFound();
    if (membership.role === 'OWNER' && role !== 'OWNER') {
      const owners = await tx.membership.count({ where: { organizationId: orgId, role: 'OWNER' } });
      if (owners <= 1) throw lastOwnerGuard();
    }
    await tx.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { role },
    });
  });
  return findMembership(userId, orgId);
}

export async function removeMember(orgId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({ where: { organizationId: orgId, userId } });
    if (!membership) throw notFound();
    if (membership.role === 'OWNER') {
      const owners = await tx.membership.count({ where: { organizationId: orgId, role: 'OWNER' } });
      if (owners <= 1) throw lastOwnerGuard();
    }
    await tx.membership.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
  });
}

export { countOwners };
