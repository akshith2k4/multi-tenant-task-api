import { config, type TenantContext } from '../../config';
import { getQueues } from '../../plugins/queues';

export async function scheduleReminder(
  ctx: TenantContext,
  taskId: string,
  dueDateIso: string,
): Promise<void> {
  if (config.isTest) return;
  const due = new Date(dueDateIso).getTime();
  if (Number.isNaN(due)) return;
  const delay = Math.max(0, due - Date.now() - 60 * 60 * 1000);
  await getQueues().reminders.add(
    'send-task-reminder',
    { taskId, orgId: ctx.orgId, dueDate: dueDateIso },
    { jobId: `reminder:${taskId}:${dueDateIso}`, delay },
  );
}

export async function cancelReminder(taskId: string, dueDateIso: string): Promise<void> {
  if (config.isTest) return;
  const job = await getQueues().reminders.getJob(`reminder:${taskId}:${dueDateIso}`);
  await job?.remove();
}
