import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export interface SignatureInput {
  rawBody: string;
  timestamp: number;
  secret: string;
}

export function computeSignature({ rawBody, timestamp, secret }: SignatureInput): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export function signatureHeader(rawBody: string, secret: string): string {
  return computeSignature({ rawBody, timestamp: Math.floor(Date.now() / 1000), secret });
}

export function verifySignature(header: string, rawBody: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index), part.slice(index + 1)];
    }),
  );
  const timestamp = Number(parts['t']);
  const received = parts['v1'];
  if (!timestamp || !received) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = computeSignature({ rawBody, timestamp, secret }).split('v1=')[1] ?? '';
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function decryptSecret(ciphertext: string): string {
  return Buffer.from(ciphertext, 'base64').toString('utf8');
}

export function encryptSecret(secret: string): string {
  return Buffer.from(secret, 'utf8').toString('base64');
}

export function generateWebhookSecret(): string {
  return createHmac('sha256', config.webhookSecretKey)
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex');
}
