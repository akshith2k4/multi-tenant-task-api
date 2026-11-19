import type { FastifyPluginAsync } from 'fastify';
import { LoginBody, RefreshBody, RegisterBody } from './schemas';
import { registerHandler } from './register';
import { loginHandler } from './login';
import { refreshHandler } from './refresh';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/register', { config: { public: true }, schema: { body: RegisterBody } }, registerHandler);
  app.post('/auth/login', { config: { public: true }, schema: { body: LoginBody } }, loginHandler);
  app.post('/auth/refresh', { config: { public: true }, schema: { body: RefreshBody } }, refreshHandler);
};
