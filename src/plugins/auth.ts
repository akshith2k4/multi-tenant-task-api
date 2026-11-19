import fp from 'fastify-plugin';
import { jwtVerify, SignJWT } from 'jose';
import type { FastifyPluginAsync } from 'fastify';
import { config, type AuthClaims } from '../config';
import { invalidToken, unauthenticated } from '../lib/errors';
import { prisma } from '../lib/db';

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ email: claims.email, type: claims.type })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
    .sign(key(config.jwtSecret));
}

export async function signRefreshToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ email: claims.email, type: claims.type })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.refreshTokenTtlSeconds}s`)
    .sign(key(config.jwtRefreshSecret));
}

export async function verifyToken(token: string, type: 'access' | 'refresh'): Promise<AuthClaims> {
  try {
    const secret = type === 'access' ? config.jwtSecret : config.jwtRefreshSecret;
    const { payload } = await jwtVerify(token, key(secret));
    if (!payload.sub || payload.type !== type) throw invalidToken();
    return { sub: payload.sub, email: String(payload.email ?? ''), type };
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid or expired token') throw error;
    throw invalidToken();
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (request) => {
    if (request.routeOptions.config?.public) return;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthenticated();
    const claims = await verifyToken(header.slice(7), 'access');
    const user = await prisma.user.findFirst({ where: { id: claims.sub } });
    if (!user) throw unauthenticated();
    request.user = { id: user.id, email: user.email };
  });
});
