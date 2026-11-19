import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';

export { Prisma };
export type {
  User,
  Organization,
  Membership,
  Project,
  Task,
  AuditLog,
  WebhookEndpoint,
  WebhookDelivery,
} from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
  log: config.isTest ? [] : ['error', 'warn'],
});

export type Tx = Prisma.TransactionClient;
