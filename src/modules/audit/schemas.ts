import { Type } from '@sinclair/typebox';

export const AuditQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
});

export interface AuditQueryInput {
  page?: number;
  pageSize?: number;
}
