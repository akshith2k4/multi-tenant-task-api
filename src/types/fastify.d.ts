import type { Role } from './enums';

declare module 'fastify' {
  interface FastifyRequest {
    id: string;
    user?: { id: string; email: string };
    ctx?: { orgId: string; userId: string; role: Role };
  }

  interface FastifyContextConfig {
    public?: boolean;
    tenant?: boolean;
    permission?: 'member' | 'owner-admin' | 'owner';
  }
}

export {};
