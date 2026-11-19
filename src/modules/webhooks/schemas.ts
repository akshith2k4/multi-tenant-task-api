import { Type } from '@sinclair/typebox';

export const CreateWebhookBody = Type.Object({
  url: Type.String({ format: 'uri' }),
  events: Type.Array(Type.String(), { minItems: 1 }),
});

export const UpdateWebhookBody = Type.Object({
  url: Type.Optional(Type.String({ format: 'uri' })),
  events: Type.Optional(Type.Array(Type.String(), { minItems: 1 })),
  enabled: Type.Optional(Type.Boolean()),
});

export interface CreateWebhookInput {
  url: string;
  events: string[];
}
export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  enabled?: boolean;
}
