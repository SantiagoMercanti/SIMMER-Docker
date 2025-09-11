import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

type Role = 'operator' | 'labManager' | 'admin';

function isRole(x: unknown): x is Role {
  return x === 'operator' || x === 'labManager' || x === 'admin';
}

// PATCH /api/users/:id  → cambiar tipo (rol)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAdmin();

    const body = await req.json();
    const nuevoTipo: unknown = body?.tipo;

    if (!isRole(nuevoTipo)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use operator | labManager | admin' },
        { status: 400 }
      );
    }

    // Buscamos el usuario objetivo
    const target = await prisma.userMetadata.findUnique({
      where: { id },
      select: { id: true, tipo: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Si estamos degradando de admin → validar que no sea el último admin
    if (target.tipo === 'admin' && nuevoTipo !== 'admin') {
      const adminCount = await prisma.userMetadata.count({
        where: { tipo: 'admin' },
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
    return NextResponse.json({ error: 'Actualización fallida' }, { status: 400 });
  }
}

// DELETE /api/users/:id  → eliminar usuario
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const acting = await requireAdmin(); // quién ejecuta

    // Evitar auto-eliminación (opcional pero recomendado)
    if (acting.id === id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propio usuario' },
        { status: 400 }
      );
    }

    const target = await prisma.userMetadata.findUnique({
      where: { id },
      select: { id: true, tipo: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Si es admin → validar que no sea el último admin antes de borrar
    if (target.tipo === 'admin') {
      const adminCount = await prisma.userMetadata.count({
        where: { tipo: 'admin' },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'No puedes eliminar al último administrador' },
          { status: 400 }
        );
      }
    }

    await prisma.userMetadata.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Acceso solo para administradores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Eliminación fallida' }, { status: 400 });
  }
}
