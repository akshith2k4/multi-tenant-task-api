import { prisma } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { config } from '../../config';
import { getQueues } from '../../plugins/queues';

export async function replayDeadDelivery(orgId: string, deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, organizationId: orgId } });
  if (!delivery) throw notFound();
  const updated = await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: null, lockedAt: null, lastError: null },
  });
  if (!config.isTest) {
    await getQueues().webhooks.add(
      'deliver-webhook',
      { deliveryId, orgId, endpointId: delivery.endpointId, eventId: delivery.eventId },
      { jobId: `webhook:${delivery.endpointId}:${delivery.eventId}` },
    );
  }
  return updated;
}
