import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

type Role = 'operator' | 'labManager' | 'admin';

function isRole(x: unknown): x is Role {
  return x === 'operator' || x === 'labManager' || x === 'admin';
}

// Email de admin protegido (no se puede cambiar rol ni desactivar)
const PROTECTED_ADMIN_EMAIL = 'simmeringar@gmail.com';

// PATCH /api/users/:id  → cambiar tipo (rol)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const acting = await requireAdmin(); // quién ejecuta

    const body = await req.json();
    const nuevoTipo: unknown = body?.tipo;

    if (!isRole(nuevoTipo)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use operator | labManager | admin' },
        { status: 400 }
      );
    }

    // Usuario objetivo (debe estar activo)
    const target = await prisma.userMetadata.findUnique({
      where: { id },
      select: { id: true, email: true, tipo: true, activo: true },
    });

    if (!target || !target.activo) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o inactivo' },
        { status: 404 }
      );
    }

    // Protección: no permitir cambiar el rol del admin principal por email
    if (target.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'No puedes cambiar el rol del administrador principal' },
        { status: 403 }
      );
    }

    // Protección: un admin no puede auto-degradarse (de admin a otro rol)
    if (acting.id === target.id && target.tipo === 'admin' && nuevoTipo !== 'admin') {
      return NextResponse.json(
        { error: 'No puedes degradarte a ti mismo' },
        { status: 400 }
      );
    }

    // Si degradamos un admin, asegurar que no sea el último admin ACTIVO
    if (target.tipo === 'admin' && nuevoTipo !== 'admin') {
      const adminCount = await prisma.userMetadata.count({
        where: { tipo: 'admin', activo: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'No puedes degradar al último administrador' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.userMetadata.update({
      where: { id: target.id },
      data: { tipo: nuevoTipo },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        tipo: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Acceso solo para administradores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    console.error('PATCH /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Actualización fallida' }, { status: 400 });
  }
}

// DELETE /api/users/:id  → soft-delete (activo=false)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const acting = await requireAdmin(); // quién ejecuta

    // Evitar auto-desactivación
    if (acting.id === id) {
      return NextResponse.json(
        { error: 'No puedes desactivarte a ti mismo' },
        { status: 400 }
      );
    }

    const target = await prisma.userMetadata.findUnique({
      where: { id },
      select: { id: true, email: true, tipo: true, activo: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // ❗ Protección: no permitir desactivar al admin principal por email
    if (target.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'No puedes desactivar al administrador principal' },
        { status: 403 }
      );
    }

    if (!target.activo) {
      // ya estaba inactivo: idempotencia
      return NextResponse.json({ ok: true, alreadyInactive: true });
    }

    // Si es admin, asegurar que no sea el último admin ACTIVO
    if (target.tipo === 'admin') {
      const adminCount = await prisma.userMetadata.count({
        where: { tipo: 'admin', activo: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'No puedes desactivar al último administrador' },
          { status: 400 }
        );
      }
    }

    // ¿Existe otro INACTIVO con el mismo email? (respetar @@unique([email, activo]))
    const conflict = await prisma.userMetadata.findFirst({
      where: { email: target.email, activo: false, NOT: { id: target.id } },
      select: { id: true },
    });

    let newEmail = target.email;
    if (conflict) {
      const at = target.email.indexOf('@');
      if (at > 0) {
        const local = target.email.slice(0, at);
        const domain = target.email.slice(at + 1);
        newEmail = `${local}+inactive-${target.id}@${domain}`;
      } else {
        newEmail = `${target.email}#inactive-${target.id}`;
      }
    }

    await prisma.userMetadata.update({
      where: { id: target.id },
      data: { activo: false, ...(newEmail !== target.email ? { email: newEmail } : {}) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Acceso solo para administradores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }
      if (err.code === 'P2002') {
        // por si aún así se produce un choque de unicidad
        return NextResponse.json(
          { error: 'Conflicto de unicidad al desactivar usuario' },
          { status: 409 }
        );
      }
    }

    console.error('DELETE /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Eliminación (soft) fallida' }, { status: 400 });
  }
}
