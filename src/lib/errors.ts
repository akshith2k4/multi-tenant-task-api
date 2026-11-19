export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_TOKEN'
  | 'VALIDATION_ERROR'
  | 'EMAIL_IN_USE'
  | 'RESOURCE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'LAST_OWNER_GUARD'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (): AppError =>
  new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');

export const forbidden = (message = 'Insufficient role'): AppError =>
  new AppError(403, 'FORBIDDEN', message);

export const unauthenticated = (): AppError =>
  new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

export const invalidToken = (): AppError =>
  new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');

export const validationError = (details: Record<string, unknown>): AppError =>
  new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);

export const emailInUse = (): AppError =>
  new AppError(409, 'EMAIL_IN_USE', 'Email address is already registered');

export const lastOwnerGuard = (): AppError =>
  new AppError(409, 'LAST_OWNER_GUARD', 'Transfer ownership before changing the last OWNER');
