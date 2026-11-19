import { prisma } from '../../lib/db';
import type { Membership } from '../../lib/db';
import type { Role } from '../../types/enums';

export async function findMembership(
  userId: string,
  organizationId: string,
): Promise<Membership | null> {
  return prisma.membership.findFirst({ where: { userId, organizationId } });
}

export async function listMemberships(userId: string): Promise<Membership[]> {
  return prisma.membership.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function listMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function countOwners(organizationId: string): Promise<number> {
  return prisma.membership.count({ where: { organizationId, role: 'OWNER' } });
}

export async function addMembership(
  organizationId: string,
  userId: string,
  role: Role,
): Promise<Membership> {
  return prisma.membership.create({ data: { organizationId, userId, role } });
}

export async function updateMembershipRole(
  organizationId: string,
  userId: string,
  role: Role,
): Promise<Membership> {
  return prisma.membership.update({
    where: { organizationId_userId: { organizationId, userId } },
    data: { role },
  });
}

export async function removeMembership(organizationId: string, userId: string): Promise<void> {
  await prisma.membership.delete({
    where: { organizationId_userId: { organizationId, userId } },
  });
}
