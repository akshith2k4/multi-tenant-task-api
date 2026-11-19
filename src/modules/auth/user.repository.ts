import bcrypt from 'bcrypt';
import { prisma } from '../../lib/db';
import { emailInUse } from '../../lib/errors';
import type { User } from '../../lib/db';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { email: normalizeEmail(email) } });
}

export async function createUser(email: string, password: string): Promise<User> {
  const normalized = normalizeEmail(email);
  if (await findByEmail(normalized)) throw emailInUse();
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { email: normalized, passwordHash } });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
