import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';

export interface ReminderJobData {
  taskId: string;
  orgId: string;
  dueDate: string;
}

export interface WebhookJobData {
  deliveryId: string;
  orgId: string;
  endpointId: string;
  eventId: string;
}

let connection: Redis | undefined;

export function redisConnection(): Redis {
  connection ??= new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
  return connection;
}

export function createQueues() {
  const opts = { connection: redisConnection() };
  return {
    reminders: new Queue<ReminderJobData>('task-reminders', {
      ...opts,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnFail: false,
        removeOnComplete: 1000,
      },
    }),
    remindersDlq: new Queue<ReminderJobData>('task-reminders-dlq', opts),
    webhooks: new Queue<WebhookJobData>('webhook-delivery', {
      ...opts,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnFail: false,
        removeOnComplete: 1000,
      },
    }),
    webhooksDlq: new Queue<WebhookJobData>('webhook-delivery-dlq', opts),
  };
}

export type Queues = ReturnType<typeof createQueues>;

let queues: Queues | undefined;
export function getQueues(): Queues {
  queues ??= createQueues();
  return queues;
}

export function registerWorkers(): Worker[] {
  const opts = { connection: redisConnection() };
  const { processReminder } = requireJobs();
  const { processWebhook } = requireJobs();
  return [
    new Worker<ReminderJobData>('task-reminders', processReminder, opts),
    new Worker<WebhookJobData>('webhook-delivery', processWebhook, opts),
  ];
}

function requireJobs() {
  return {
    processReminder: async (job: { data: ReminderJobData }) => {
      const { handleReminder } = await import('../jobs/task-reminder');
      return handleReminder(job.data);
    },
    processWebhook: async (job: { data: WebhookJobData }) => {
      const { handleWebhookDelivery } = await import('../jobs/webhook-delivery');
      return handleWebhookDelivery(job.data);
    },
  };
}
