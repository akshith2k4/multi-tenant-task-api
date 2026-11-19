import { prisma } from '../lib/db';
import type { ReminderJobData } from '../plugins/queues';
import { emitWebhookEvent } from '../modules/webhooks/events';

export async function handleReminder(data: ReminderJobData): Promise<unknown> {
  const claimed = await prisma.task.updateMany({
    where: {
      id: data.taskId,
      organizationId: data.orgId,
      reminderSentAt: null,
    },
    data: { reminderSentAt: new Date() },
  });
  if (claimed.count === 0) return { skipped: true };

  await emitWebhookEvent(
    { orgId: data.orgId, userId: 'system', role: 'MEMBER' },
    'task.reminder_due',
    { taskId: data.taskId, dueDate: data.dueDate },
  );
  return { reminded: true };
}
