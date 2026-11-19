import type { TenantContext } from '../../config';
import { prisma } from '../../lib/db';
import { writeAudit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import type { Project } from '../../lib/db';
import { emitWebhookEvent } from '../webhooks/events';

export async function createProject(
  ctx: TenantContext,
  name: string,
  description?: string,
): Promise<Project> {
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        organizationId: ctx.orgId,
        name,
        description: description ?? null,
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'PROJECT_CREATE',
      targetType: 'PROJECT',
      targetId: created.id,
      after: created,
    });
    return created;
  });
  await emitWebhookEvent(ctx, 'project.created', { project });
  return project;
}

export async function listProjects(ctx: TenantContext): Promise<Project[]> {
  return prisma.project.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProject(ctx: TenantContext, projectId: string): Promise<Project | null> {
  return prisma.project.findFirst({ where: { id: projectId, organizationId: ctx.orgId } });
}

export async function updateProject(
  ctx: TenantContext,
  projectId: string,
  data: { name?: string; description?: string | null },
): Promise<Project> {
  const before = await getProject(ctx, projectId);
  if (!before) throw notFound();
  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id_organizationId: { id: projectId, organizationId: ctx.orgId } },
      data: {
        ...(data.name === undefined ? {} : { name: data.name }),
        ...(data.description === undefined ? {} : { description: data.description }),
      },
    });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'PROJECT_UPDATE',
      targetType: 'PROJECT',
      targetId: projectId,
      before,
      after: updated,
    });
    return updated;
  });
  await emitWebhookEvent(ctx, 'project.updated', { project });
  return project;
}

export async function deleteProject(ctx: TenantContext, projectId: string): Promise<void> {
  const before = await getProject(ctx, projectId);
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { projectId, organizationId: ctx.orgId } });
    await tx.project.delete({
      where: { id_organizationId: { id: projectId, organizationId: ctx.orgId } },
    });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'PROJECT_DELETE',
      targetType: 'PROJECT',
      targetId: projectId,
      before,
    });
  });
  await emitWebhookEvent(ctx, 'project.deleted', { projectId });
}
