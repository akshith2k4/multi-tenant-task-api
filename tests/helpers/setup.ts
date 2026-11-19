import { afterAll, beforeAll, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/taskapi_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.WEBHOOK_SECRET_KEY = 'test-webhook-key';

let prismaClient: {
  $executeRawUnsafe(query: string): Promise<number>;
  $disconnect(): Promise<void>;
} | undefined;
let appInstance: any;

beforeAll(async () => {
  const db = await import('../../src/lib/db');
  prismaClient = db.prisma;
  const { buildApp } = await import('../../src/app');
  const app = await buildApp();
  appInstance = app;
  await app.ready();
});

beforeEach(async () => {
  if (!prismaClient) return;
  await prismaClient.$executeRawUnsafe(
    'TRUNCATE "WebhookDelivery", "WebhookEndpoint", "AuditLog", "Task", "Project", "Membership", "Organization", "User" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await appInstance?.close();
  await prismaClient?.$disconnect();
});

export function getApp() {
  if (!appInstance) throw new Error('Test app not initialized');
  return appInstance;
}

export function getPrisma() {
  if (!prismaClient) throw new Error('Test Prisma client not initialized');
  return prismaClient;
}
