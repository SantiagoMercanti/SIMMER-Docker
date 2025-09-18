import { NextResponse } from 'next/server';
// import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';

type PatchBody = {
  nombre?: string;
  apellido?: string;
  email?: string;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// GET /api/me → { id, email, role, nombre, apellido }
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id, email, role, nombre, apellido } = user;
    return NextResponse.json({ id, email, role, nombre, apellido });
  } catch {
    return NextResponse.json({ error: 'Error obteniendo sesión' }, { status: 500 });
  }
}

// PATCH /api/me → el propio usuario puede actualizar nombre, apellido o email
export async function PATCH(req: Request) {
  try {
    // 1) Autenticación obligatoria (misma idea que requireAdmin, pero para cualquier user)
    const acting = await requireAuth(); // { id, tipo/role, ... }

    // 2) Parseo + whitelist + sanitización
    const body = (await req.json()) as PatchBody;

    const updates: PatchBody = {};
    if (typeof body.nombre === 'string') updates.nombre = body.nombre.trim();
    if (typeof body.apellido === 'string') updates.apellido = body.apellido.trim();
    if (typeof body.email === 'string') updates.email = body.email.trim().toLowerCase();

    // 3) Validaciones mínimas (ajustá si querés reglas más estrictas)
    if (
      updates.nombre !== undefined &&
      updates.nombre.length < 2
    ) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres.' }, { status: 400 });
    }
    if (
      updates.apellido !== undefined &&
      updates.apellido.length < 2
    ) {
      return NextResponse.json({ error: 'El apellido debe tener al menos 2 caracteres.' }, { status: 400 });
    }
    if (
      updates.email !== undefined &&
      !isEmail(updates.email)
    ) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No se enviaron campos actualizables.' }, { status: 400 });
    }

    // 4) Si cambia el email, verificar unicidad (excluyendo al propio usuario)
    if (updates.email) {
      const current = await prisma.userMetadata.findUnique({
        where: { id: acting.id },
        select: { email: true },
      });

      // Solo si realmente cambia
      if (current && updates.email !== current.email) {
        const exists = await prisma.userMetadata.count({
          where: { email: updates.email, id: { not: acting.id } },
        });
        if (exists > 0) {
          return NextResponse.json({ error: 'El email ya está en uso.' }, { status: 409 });
        }
      }
    }

    // 5) Persistir cambios (solo en los campos permitidos)
    const updated = await prisma.userMetadata.update({
      where: { id: acting.id },
      data: updates,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        tipo: true,       // por consistencia con tus selects
        createdAt: true,
        updatedAt: true,
      },
    });

    // 6) (Opcional) refrescar sesión si tu estrategia cachea email/nombre en cookie/JWT
    // await refreshSession(updated); // depende de tu implementación en lib/auth

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Prohibido' }, { status });

    // if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    //   // Improbable aquí (update por id propio), pero dejamos manejo simétrico
    //   return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    // }

    return NextResponse.json({ error: 'No se pudo actualizar el perfil' }, { status: 400 });
  }
}
