import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../config';
import { config } from '../../config';
import { prisma, Prisma } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { encryptSecret, generateWebhookSecret } from '../../lib/signature';
import { getQueues } from '../../plugins/queues';
import type { CreateWebhookInput, UpdateWebhookInput } from './schemas';

export async function createEndpoint(ctx: TenantContext, input: CreateWebhookInput) {
  const secret = generateWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId: ctx.orgId,
      url: input.url,
      secretCiphertext: encryptSecret(secret),
      events: input.events,
      createdById: ctx.userId,
    },
  });
  return { endpoint, secret };
}

export async function listEndpoints(ctx: TenantContext) {
  return prisma.webhookEndpoint.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateEndpoint(
  ctx: TenantContext,
  endpointId: string,
  input: UpdateWebhookInput,
) {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: ctx.orgId },
  });
  if (!existing) throw notFound();
  return prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      ...(input.url === undefined ? {} : { url: input.url }),
      ...(input.events === undefined ? {} : { events: input.events }),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    },
  });
}

export async function deleteEndpoint(ctx: TenantContext, endpointId: string) {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: ctx.orgId },
  });
  if (!existing) throw notFound();
  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
}

export async function createTestDelivery(ctx: TenantContext, endpointId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: ctx.orgId },
  });
  if (!endpoint) throw notFound();
  const eventId = randomUUID();
  try {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        organizationId: ctx.orgId,
        endpointId,
        eventId,
        eventType: 'test.delivery',
        payload: { rawBody: JSON.stringify({ event: 'test.delivery', data: { endpointId } }) },
      },
    });
    if (!config.isTest) {
      await getQueues().webhooks.add(
        'deliver-webhook',
        { deliveryId: delivery.id, orgId: ctx.orgId, endpointId, eventId },
        { jobId: `webhook:${endpointId}:${eventId}` },
      );
    }
    return delivery;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.webhookDelivery.findFirst({
        where: { endpointId, eventId },
      });
    }
    throw error;
  }
}
