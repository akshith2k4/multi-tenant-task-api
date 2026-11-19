export interface Envelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function ok(details?: Record<string, unknown>): Envelope {
  return details === undefined
    ? { code: 'OK', message: 'OK' }
    : { code: 'OK', message: 'OK', details };
}

export function created(details: Record<string, unknown>): Envelope {
  return { code: 'CREATED', message: 'Created', details };
}

export function accepted(details: Record<string, unknown>): Envelope {
  return { code: 'ACCEPTED', message: 'Accepted', details };
}

export function errorEnvelope(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Envelope {
  return details === undefined ? { code, message } : { code, message, details };
}
