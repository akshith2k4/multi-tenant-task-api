import { describe, expect, it } from 'vitest';
import { getPrisma } from '../helpers/setup';
import { randomUUID } from 'node:crypto';
import { handleReminder } from '../../src/jobs/task-reminder';
import { handleWebhookDelivery } from '../../src/jobs/webhook-delivery';

describe('idempotency', () => {
  it('a replayed reminder is applied only once via reminderSentAt', async () => {
    const prisma = getPrisma() as unknown as {
      organization: { create(args: unknown): Promise<{ id: string }> };
      user: { create(args: unknown): Promise<{ id: string }> };
      project: { create(args: unknown): Promise<{ id: string }> };
      task: {
        create(args: unknown): Promise<{ id: string; reminderSentAt: Date | null }>;
        findFirst(args: unknown): Promise<{ reminderSentAt: Date | null } | null>;
      };
    };
    const user = await prisma.user.create({
      data: { email: `rem-${randomUUID()}@example.com`, passwordHash: 'x' },
    });
    const org = await prisma.organization.create({ data: { name: 'R', createdById: user.id } });
    const project = await prisma.project.create({
      data: { organizationId: org.id, createdById: user.id, name: 'P' },
    });
    const task = await prisma.task.create({
      data: { organizationId: org.id, projectId: project.id, createdById: user.id, title: 'T' },
    });
    const data = { taskId: task.id, orgId: org.id, dueDate: '2030-01-01T00:00:00.000Z' };
    expect(await handleReminder(data)).toMatchObject({ reminded: true });
    expect(await handleReminder(data)).toMatchObject({ skipped: true });
    const stored = await prisma.task.findFirst({ where: { id: task.id } });
    expect(stored?.reminderSentAt).not.toBeNull();
  });

  it('webhook deliveries are unique per endpoint and eventId', async () => {
    const prisma = getPrisma() as unknown as {
      organization: { create(args: unknown): Promise<{ id: string }> };
      user: { create(args: unknown): Promise<{ id: string }> };
      webhookEndpoint: { create(args: unknown): Promise<{ id: string }> };
      webhookDelivery: {
        create(args: unknown): Promise<{ id: string }>;
        count(args: unknown): Promise<number>;
      };
    };
    const user = await prisma.user.create({
      data: { email: `hook-${randomUUID()}@example.com`, passwordHash: 'x' },
    });
    const org = await prisma.organization.create({ data: { name: 'H', createdById: user.id } });
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        url: 'https://example.com/hook',
        secretCiphertext: 'c2VjcmV0',
        events: ['task.created'],
      },
    });
    const eventId = randomUUID();
    await prisma.webhookDelivery.create({
      data: {
        organizationId: org.id,
        endpointId: endpoint.id,
        eventId,
        eventType: 'task.created',
        payload: { rawBody: '{}' },
      },
    });
    await expect(
      prisma.webhookDelivery.create({
        data: {
          organizationId: org.id,
          endpointId: endpoint.id,
          eventId,
          eventType: 'task.created',
          payload: { rawBody: '{}' },
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.webhookDelivery.count({ where: { endpointId: endpoint.id } })).toBe(1);
    expect(typeof handleWebhookDelivery).toBe('function');
  });
});
