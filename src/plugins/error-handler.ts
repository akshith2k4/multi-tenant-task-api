import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../lib/errors';
import { errorEnvelope } from '../lib/envelope';
import { Prisma } from '../lib/db';

export const errorHandlerPlugin: FastifyPluginAsync = fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(errorEnvelope('RESOURCE_NOT_FOUND', 'Resource not found'));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.status).send(
        errorEnvelope(error.code, error.message, error.details),
      );
      return;
    }

    if (error.validation) {
      reply.code(400).send(
        errorEnvelope('VALIDATION_ERROR', 'Validation failed', {
          fieldErrors: error.validation.map((item) => ({
            field: item.instancePath || item.params?.missingProperty || 'body',
            message: item.message ?? 'invalid',
          })),
        }),
      );
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      reply.code(409).send(errorEnvelope('EMAIL_IN_USE', 'Email address is already registered'));
      return;
    }

    if (error.statusCode && error.statusCode < 500) {
      reply.code(error.statusCode).send(
        errorEnvelope('VALIDATION_ERROR', error.message),
      );
      return;
    }

    request.log.error(error);
    reply.code(500).send(errorEnvelope('INTERNAL_ERROR', 'Internal server error'));
  });
});
