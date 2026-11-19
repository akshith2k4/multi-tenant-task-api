import type { Job } from 'bullmq';
import { prisma } from '../lib/db';
import { decryptSecret, signatureHeader } from '../lib/signature';
import type { WebhookJobData } from '../plugins/queues';

function nextDelay(attempt: number): number {
  const exponential = Math.min(5 * 60 * 1000, 1000 * 2 ** attempt);
  return Math.round(Math.random() * exponential);
}

export async function handleWebhookDelivery(data: WebhookJobData, job?: Job): Promise<unknown> {
  const now = new Date();
  const claimed = await prisma.webhookDelivery.updateMany({
    where: {
      id: data.deliveryId,
      status: { in: ['PENDING', 'DEAD'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: { status: 'SENDING', lockedAt: now },
  });
  if (claimed.count === 0) return { skipped: true };

  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: data.deliveryId } });
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: data.endpointId } });
  if (!delivery || !endpoint) {
    await prisma.webhookDelivery.update({
      where: { id: data.deliveryId },
      data: { status: 'DEAD', lockedAt: null },
    });
    return { dead: true };
  }

  const rawBody =
    typeof delivery.payload === 'object' && delivery.payload !== null && 'rawBody' in delivery.payload
      ? String((delivery.payload as { rawBody: unknown }).rawBody)
      : JSON.stringify(delivery.payload);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': signatureHeader(rawBody, decryptSecret(endpoint.secretCiphertext)),
        'x-event-id': delivery.eventId,
        'x-event-type': delivery.eventType,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Webhook responded with ${response.status}`);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'DELIVERED', lockedAt: null, lastError: null },
    });
    return { delivered: true };
  } catch (error) {
    const attempt = job?.attemptsMade ?? delivery.attempts + 1;
    const terminal = attempt >= 5;
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: terminal ? 'DEAD' : 'PENDING',
        attempts: attempt,
        nextAttemptAt: terminal ? null : new Date(Date.now() + nextDelay(attempt)),
        lockedAt: null,
        lastError: error instanceof Error ? error.message : 'delivery failed',
      },
    });
    if (terminal) {
      await (await import('../plugins/queues')).getQueues().webhooksDlq.add('dead-webhook', data);
      return { dead: true };
    }
    throw error;
  }
}
