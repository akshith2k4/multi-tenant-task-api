import { randomUUID } from 'node:crypto';
import { config, type TenantContext } from '../../config';
import { prisma, Prisma } from '../../lib/db';
import { WEBHOOK_EVENTS, type WebhookEvent } from '../../types/enums';
import { getQueues } from '../../plugins/queues';

export async function emitWebhookEvent(
  ctx: TenantContext,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!(WEBHOOK_EVENTS as readonly string[]).includes(eventType)) return;
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: ctx.orgId, enabled: true },
  });
  const rawBody = JSON.stringify({ event: eventType, data: payload });
  for (const endpoint of endpoints) {
    if (!endpoint.events.includes(eventType)) continue;
    const eventId = randomUUID();
    try {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          organizationId: ctx.orgId,
          endpointId: endpoint.id,
          eventId,
          eventType,
          payload: { rawBody },
        },
      });
      if (!config.isTest) {
        await getQueues().webhooks.add(
          'deliver-webhook',
          {
            deliveryId: delivery.id,
            orgId: ctx.orgId,
            endpointId: endpoint.id,
            eventId,
          },
          { jobId: `webhook:${endpoint.id}:${eventId}` },
        );
      }
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }
}
