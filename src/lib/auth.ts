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

// ============================================
// HELPERS PARA OWNERSHIP
// ============================================

/**
 * Construye un filtro de Prisma para ownership.
 * - Admin ve todo (filtro vacío)
 * - Otros roles solo ven recursos que crearon (creadorId)
 */
export function getOwnershipFilter(userId: string, userRole: Role) {
  if (userRole === 'admin') {
    return {}; // Admin ve todo
  }
  return { creadorId: userId }; // Solo sus recursos
}

/**
 * Verifica si el usuario actual puede acceder a un recurso específico.
 * - Admin puede acceder a todo
 * - Otros solo pueden acceder a recursos que crearon
 */
export function canAccessResource(
  resourceCreatorId: string,
  currentUser: { id: string; role: Role }
): boolean {
  if (currentUser.role === 'admin') return true;
  return resourceCreatorId === currentUser.id;
}

/**
 * Verifica si el usuario actual puede acceder a un proyecto específico.
 * - Admin puede acceder a todo
 * - El creador siempre puede acceder a sus proyectos
 * - Proyectos públicos son visibles para cualquier usuario autenticado
 * - Proyectos privados solo son visibles para su creador (y admin)
 */
export function canAccessProject(
  project: { creadorId: string; publico: boolean },
  currentUser: { id: string; role: Role }
): boolean {
  if (currentUser.role === 'admin') return true;
  if (project.creadorId === currentUser.id) return true;
  return project.publico === true;
}

/**
 * Construye el filtro de Prisma para listar proyectos según el usuario.
 * - Admin: ve todos
 * - Otros: ven sus propios proyectos + los públicos
 */
export function getProjectFilter(userId: string, userRole: Role) {
  if (userRole === 'admin') {
    return {};
  }
  return {
    OR: [
      { creadorId: userId },
      { publico: true },
    ],
  };
}

/**
 * Verifica si el usuario actual puede modificar un recurso específico.
 * Requiere tanto permiso de mutación (no-operator) como ownership.
 */
export function canModifyResource(
  resourceCreatorId: string,
  currentUser: { id: string; role: Role }
): boolean {
  // Si es operator, no puede modificar nada
  if (!canEdit(currentUser.role)) return false;
  
  // Si es admin, puede modificar todo
  if (currentUser.role === 'admin') return true;
  
  // labManager solo puede modificar sus propios recursos
  return resourceCreatorId === currentUser.id;
}

/**
 * Verifica si el usuario puede acceder a un sensor.
 * Además de ser el creador o admin, se permite el acceso si el sensor
 * está vinculado a al menos un proyecto público activo.
 * Requiere acceso a prisma para la consulta de proyectos públicos.
 */
export async function canAccessSensor(
  sensor: { creadorId: string },
  currentUser: { id: string; role: Role },
  sensorId: number,
  prismaClient: { proyectoSensor: { count: (args: unknown) => Promise<number> } }
): Promise<boolean> {
  // Admin siempre puede
  if (currentUser.role === 'admin') return true;
  // El creador siempre puede
  if (sensor.creadorId === currentUser.id) return true;
  // Verificar si está vinculado a algún proyecto público activo
  const count = await prismaClient.proyectoSensor.count({
    where: {
      sensorId,
      proyecto: {
        activo: true,
        publico: true,
      },
    },
  });
  return count > 0;
}
