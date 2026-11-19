import { Type } from '@sinclair/typebox';
import { TASK_STATUSES } from '../../types/enums';

const Status = Type.Union(TASK_STATUSES.map((value) => Type.Literal(value)));

export const CreateTaskBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String()),
  assigneeId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  status: Type.Optional(Status),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
});

export const UpdateTaskBody = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assigneeId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  status: Type.Optional(Status),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
});

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId?: string | null;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string | null;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}
