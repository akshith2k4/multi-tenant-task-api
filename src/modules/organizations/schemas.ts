import { Type } from '@sinclair/typebox';

export const CreateOrganizationBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
});

export type CreateOrganizationInput = { name: string };
