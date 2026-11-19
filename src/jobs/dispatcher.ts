import { prisma } from '../lib/db';
import { config } from '../config';
import { getQueues, type ReminderJobData, type WebhookJobData } from '../plugins/queues';

export async function sweepStaleLeases(): Promise<number> {
  const cutoff = new Date(Date.now() - 60_000);
  const result = await prisma.webhookDelivery.updateMany({
    where: { status: 'SENDING', lockedAt: { lt: cutoff } },
    data: { status: 'PENDING', lockedAt: null },
  });
  return result.count;
}

export async function dispatchPending(): Promise<number> {
  if (config.isTest) return 0;
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: 'PENDING',
      lockedAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    take: 100,
  });
  const queues = getQueues();
  for (const delivery of deliveries) {
    await queues.webhooks.add(
      'deliver-webhook',
      {
        deliveryId: delivery.id,
        orgId: delivery.organizationId,
        endpointId: delivery.endpointId,
        eventId: delivery.eventId,
      },
      { jobId: `webhook:${delivery.endpointId}:${delivery.eventId}` },
    );
  }
  return deliveries.length;
}

export async function scanReminders(): Promise<number> {
  if (config.isTest) return 0;
  const horizon = new Date(Date.now() + 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: { reminderSentAt: null, dueDate: { not: null, lte: horizon } },
    take: 100,
  });
  const queues = getQueues();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    await queues.reminders.add(
      'send-task-reminder',
      { taskId: task.id, orgId: task.organizationId, dueDate: task.dueDate.toISOString() },
      {
        jobId: `reminder:${task.id}:${task.dueDate.toISOString()}`,
        delay: Math.max(0, task.dueDate.getTime() - Date.now() - 60 * 60 * 1000),
      },
    );
  }
  return tasks.length;
}

export function startSchedulers(): void {
  const queues = getQueues();
  void queues.webhooks.upsertJobScheduler(
    'dispatch-pending',
    { every: 5000 },
    { name: 'dispatch-pending', data: {} as WebhookJobData },
  );
  void queues.reminders.upsertJobScheduler(
    'scan-reminders',
    { every: 5 * 60 * 1000 },
    { name: 'scan-reminders', data: {} as ReminderJobData },
  );
}
