import { Type } from '@sinclair/typebox';

export const RegisterBody = Type.Object({
  email: Type.String({ format: 'email', minLength: 3 }),
  password: Type.String({ minLength: 8 }),
});

export const LoginBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
});

export const RefreshBody = Type.Object({
  refreshToken: Type.String({ minLength: 10 }),
});

export type RegisterInput = { email: string; password: string };
export type LoginInput = { email: string; password: string };
export type RefreshInput = { refreshToken: string };
