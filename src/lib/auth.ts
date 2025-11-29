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

/**
 * Lee el JWT (si existe) y devuelve datos básicos SIN consultar DB.
 * Útil para gating rápido, pero no confía en el rol; para rol “real” usar requireAuth/getCurrentUser.
 */
export async function getUserFromCookies(): Promise<{
  userId?: string;
  email?: string;
  role: Role; // rol del token o 'operator' por defecto
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

/** Lanza 401 si no hay JWT válido o el usuario no existe en DB. */
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
    (email &&
      (await prisma.userMetadata.findUnique({
        where: { email_activo: { email, activo: true } },
      })));

  if (!user) throw Object.assign(new Error('User not found'), { status: 401 });

  // No confiamos en el rol del token; usamos el de la DB.
  return { id: user.id, email: user.email, role: user.tipo as Role };
}

/**
 * Devuelve el usuario con datos de DB (o undefined si no hay sesión válida).
 * Útil en server components (p.ej. para hidratar permisos) sin necesidad de forzar 401.
 */
export async function getCurrentUser(): Promise<
  | {
    id: string;
    email: string;
    role: Role;
    nombre: string;
    apellido: string;
  }
  | undefined
> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return undefined;

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return undefined;
  }

  const { userId, email } = parseClaims(decoded);

  const user = await prisma.userMetadata.findFirst({
    where: {
      OR: [{ id: userId ?? '' }, { email: email ?? '' }],
    },
    select: { id: true, email: true, tipo: true, nombre: true, apellido: true },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    role: user.tipo as Role,
    nombre: user.nombre,
    apellido: user.apellido,
  };
}

/** true si el rol puede crear/editar/eliminar. */
export function canEdit(role: Role) {
  return role !== 'operator';
}

/** true si es admin. Útil para gating rápido en UI. */
export function isAdmin(role: Role) {
  return role === 'admin';
}

/** true si es labManager o admin (quedó para usos futuros más finos). */
export function isManagerOrAdmin(role: Role) {
  return role === 'labManager' || role === 'admin';
}

/**
 * Requiere sesión y, además, permiso de mutación (no-operator).
 * Lanza 401 si no hay sesión válida y 403 si el rol es 'operator'.
 */
export async function requireCanMutate(): Promise<{
  id: string;
  email: string;
  role: Role;
}> {
  const auth = await requireAuth();
  if (!canEdit(auth.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return auth;
}

/**
 * Requiere sesión válida y rol admin.
 * Lanza 401 si no hay sesión y 403 si el usuario no es admin.
 */
export async function requireAdmin(): Promise<{
  id: string;
  email: string;
  role: Role;
}> {
  const auth = await requireAuth();
  if (auth.role !== 'admin') {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return auth;
}
