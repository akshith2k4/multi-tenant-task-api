import { Type } from '@sinclair/typebox';

export const CreateProjectBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String()),
});

export const UpdateProjectBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export type CreateProjectInput = { name: string; description?: string };
export type UpdateProjectInput = { name?: string; description?: string | null };
