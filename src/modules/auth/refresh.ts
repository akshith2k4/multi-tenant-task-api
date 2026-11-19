import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../lib/envelope';
import { unauthenticated } from '../../lib/errors';
import { prisma } from '../../lib/db';
import { signAccessToken, verifyToken } from '../../plugins/auth';
import type { RefreshInput } from './schemas';

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const { refreshToken } = request.body as RefreshInput;
  const claims = await verifyToken(refreshToken, 'refresh');
  const user = await prisma.user.findFirst({ where: { id: claims.sub } });
  if (!user) throw unauthenticated();
  return reply.code(200).send(
    ok({
      accessToken: await signAccessToken({
        sub: user.id,
        email: user.email,
        type: 'access',
      }),
      expiresIn: 3600,
    }),
  );
}
