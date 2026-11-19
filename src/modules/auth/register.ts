import type { FastifyReply, FastifyRequest } from 'fastify';
import { created } from '../../lib/envelope';
import { createUser } from './user.repository';
import type { RegisterInput } from './schemas';

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = request.body as RegisterInput;
  const user = await createUser(email, password);
  return reply.code(201).send(
    created({ user: { id: user.id, email: user.email, createdAt: user.createdAt } }),
  );
}
