import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config';
import { ok } from '../../lib/envelope';
import { unauthenticated } from '../../lib/errors';
import { signAccessToken, signRefreshToken } from '../../plugins/auth';
import type { LoginInput } from './schemas';
import { findByEmail, verifyPassword } from './user.repository';

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = request.body as LoginInput;
  const user = await findByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw unauthenticated();
  const claims = { sub: user.id, email: user.email };
  return reply.code(200).send(
    ok({
      accessToken: await signAccessToken({ ...claims, type: 'access' }),
      refreshToken: await signRefreshToken({ ...claims, type: 'refresh' }),
      expiresIn: config.accessTokenTtlSeconds,
    }),
  );
}
