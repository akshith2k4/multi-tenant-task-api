import { Type } from '@sinclair/typebox';

export const AddMemberBody = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  role: Type.Union([
    Type.Literal('OWNER'),
    Type.Literal('ADMIN'),
    Type.Literal('MEMBER'),
  ]),
});

export const UpdateRoleBody = Type.Object({
  role: Type.Union([
    Type.Literal('OWNER'),
    Type.Literal('ADMIN'),
    Type.Literal('MEMBER'),
  ]),
});

export type AddMemberInput = { userId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
export type UpdateRoleInput = { role: 'OWNER' | 'ADMIN' | 'MEMBER' };
