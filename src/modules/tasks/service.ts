import type { TenantContext } from '../../config';
import { prisma } from '../../lib/db';
import type { Task } from '../../lib/db';
import { writeAudit } from '../../lib/audit';
import { notFound, validationError } from '../../lib/errors';
import { isTaskStatus, type TaskStatus } from '../../types/enums';
import { emitWebhookEvent } from '../webhooks/events';
import { cancelReminder, scheduleReminder } from './reminders';
import type { CreateTaskInput, UpdateTaskInput } from './schemas';

async function validateAssignee(ctx: TenantContext, assigneeId: string | null | undefined) {
  if (assigneeId === undefined || assigneeId === null) return;
  const membership = await prisma.membership.findFirst({
    where: { userId: assigneeId, organizationId: ctx.orgId },
  });
  if (!membership) throw validationError({ field: 'assigneeId', message: 'Not an org member' });
}

function parseStatus(value: TaskStatus | undefined | null): TaskStatus {
  if (value === undefined || value === null) return 'TODO';
  if (!isTaskStatus(value)) throw validationError({ field: 'status', message: 'Invalid status' });
  return value;
}

export async function createTask(
  ctx: TenantContext,
  projectId: string,
  input: CreateTaskInput,
): Promise<Task> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: ctx.orgId },
  });
  if (!project) throw notFound();
  await validateAssignee(ctx, input.assigneeId);

  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.dueDate && (!dueDate || Number.isNaN(dueDate.getTime()))) {
    throw validationError({ field: 'dueDate', message: 'Invalid date' });
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        organizationId: ctx.orgId,
        projectId,
        title: input.title,
        description: input.description ?? null,
        status: parseStatus(input.status),
        assigneeId: input.assigneeId ?? null,
        dueDate,
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'TASK_CREATE',
      targetType: 'TASK',
      targetId: created.id,
      after: created,
    });
    return created;
  });

  await emitWebhookEvent(ctx, 'task.created', { task });
  if (task.dueDate) await scheduleReminder(ctx, task.id, task.dueDate.toISOString());
  return task;
}

export async function listTasks(ctx: TenantContext, projectId?: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { organizationId: ctx.orgId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTask(ctx: TenantContext, taskId: string): Promise<Task | null> {
  return prisma.task.findFirst({ where: { id: taskId, organizationId: ctx.orgId } });
}

export async function updateTask(
  ctx: TenantContext,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const before = await getTask(ctx, taskId);
  if (!before) throw notFound();
  await validateAssignee(ctx, input.assigneeId);

  let dueDate: Date | undefined | null;
  if (input.dueDate !== undefined) {
    dueDate = input.dueDate === null ? null : new Date(input.dueDate);
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      throw validationError({ field: 'dueDate', message: 'Invalid date' });
    }
  }
  const status = input.status === undefined ? undefined : parseStatus(input.status);

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId, organizationId: ctx.orgId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(status === undefined ? {} : { status }),
        ...(dueDate === undefined ? {} : { dueDate }),
      },
    });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'TASK_UPDATE',
      targetType: 'TASK',
      targetId: taskId,
      before,
      after: updated,
    });
    return updated;
  });

  if (before.dueDate && before.dueDate.toISOString() !== task.dueDate?.toISOString()) {
    await cancelReminder(taskId, before.dueDate.toISOString());
  }
  if (task.dueDate) await scheduleReminder(ctx, task.id, task.dueDate.toISOString());
  await emitWebhookEvent(ctx, 'task.updated', { task });
  return task;
}

export async function deleteTask(ctx: TenantContext, taskId: string): Promise<void> {
  const before = await getTask(ctx, taskId);
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId, organizationId: ctx.orgId } });
    await writeAudit(tx, ctx, {
      actorId: ctx.userId,
      action: 'TASK_DELETE',
      targetType: 'TASK',
      targetId: taskId,
      before,
    });
  });
  if (before.dueDate) await cancelReminder(taskId, before.dueDate.toISOString());
  await emitWebhookEvent(ctx, 'task.deleted', { taskId });
}
