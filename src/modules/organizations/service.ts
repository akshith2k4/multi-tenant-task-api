import { prisma } from '../../lib/db';
import type { Organization } from '../../lib/db';

export async function createOrganization(userId: string, name: string): Promise<Organization> {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, createdById: userId } });
    await tx.membership.create({
      data: { userId, organizationId: org.id, role: 'OWNER' },
    });
    return org;
  });
}

export async function listOrganizations(userId: string): Promise<Organization[]> {
  return prisma.organization.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  return prisma.organization.findFirst({ where: { id: orgId } });
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await prisma.organization.delete({ where: { id: orgId } });
}
