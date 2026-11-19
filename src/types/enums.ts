export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'task.reminder_due',
  'project.created',
  'project.updated',
  'project.deleted',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_STATUSES = ['PENDING', 'SENDING', 'DELIVERED', 'DEAD'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}
