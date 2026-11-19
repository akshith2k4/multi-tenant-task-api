import type { Role } from './types/enums';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? '3000'),
  databaseUrl: required('DATABASE_URL', 'postgresql://app:app@localhost:5432/taskapi'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: required('JWT_SECRET', 'development-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'development-refresh-secret-change-me'),
  webhookSecretKey: required('WEBHOOK_SECRET_KEY', 'development-webhook-key-change-me'),
  accessTokenTtlSeconds: 3600,
  refreshTokenTtlSeconds: 7 * 24 * 3600,
  isTest: process.env.NODE_ENV === 'test',
};

export interface AuthClaims {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface TenantContext {
  orgId: string;
  userId: string;
  role: Role;
}
