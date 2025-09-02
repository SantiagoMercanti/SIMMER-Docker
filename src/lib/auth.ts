import { cookies } from 'next/headers';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export type Role = 'operator' | 'labManager' | 'admin';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function isRole(val: unknown): val is Role {
  return val === 'operator' || val === 'labManager' || val === 'admin';
}

function parseClaims(input: string | JwtPayload): {
  userId?: string;
  email?: string;
  role?: Role;
} {
  if (typeof input !== 'object' || input === null) return {};
  const obj = input as JwtPayload & Record<string, unknown>;

  const userId = typeof obj.userId === 'string' ? obj.userId : undefined;
  const email = typeof obj.email === 'string' ? obj.email : undefined;
  const role = isRole(obj.role) ? obj.role : undefined;

  return { userId, email, role };
}

export async function getUserFromCookies(): Promise<{
  userId?: string;
  email?: string;
  role: Role;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { role: 'operator' };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { userId, email, role } = parseClaims(decoded);
    return {
      userId,
      email,
      role: role ?? 'operator',
    };
  } catch {
    return { role: 'operator' };
  }
}

/** Lanza 401 si no hay JWT válido o el usuario no existe en DB */
export async function requireAuth(): Promise<{
  id: string;
  email: string;
  role: Role;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) throw Object.assign(new Error('Unauthenticated'), { status: 401 });

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid token'), { status: 401 });
  }

  const { userId, email } = parseClaims(decoded);

  const user =
    (userId && (await prisma.userMetadata.findUnique({ where: { id: userId } }))) ||
    (email && (await prisma.userMetadata.findUnique({ where: { email } })));

  if (!user) throw Object.assign(new Error('User not found'), { status: 401 });

  // No confiamos en el rol del token; usamos el de la DB
  return { id: user.id, email: user.email, role: user.tipo as Role };
}

export function isManagerOrAdmin(role: Role) {
  return role === 'labManager' || role === 'admin';
}
