// Archivo: src/app/api/projects/[id]/notes/[noteId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// PATCH /api/projects/:id/notes/:noteId - Actualizar una nota
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  const projectId = Number(id);
  const notaId = Number(noteId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  if (!Number.isInteger(notaId) || notaId <= 0) {
    return NextResponse.json({ error: 'ID de nota inválido' }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que la nota existe y pertenece al proyecto
    const nota = await prisma.notaProyecto.findFirst({
      where: {
        id: notaId,
        proyectoId: projectId,
      },
      select: {
        usuarioId: true,
        proyecto: {
          select: {
            creadorId: true,
          },
        },
      },
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    // Solo el creador de la nota o un admin pueden editarla
    if (nota.usuarioId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para editar esta nota' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { contenido } = body;

    if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
      return NextResponse.json({ error: 'El contenido de la nota es obligatorio' }, { status: 400 });
    }

    // Actualizar la nota
    const notaActualizada = await prisma.notaProyecto.update({
      where: { id: notaId },
      data: { contenido: contenido.trim() },
      select: {
        id: true,
        contenido: true,
        createdAt: true,
        updatedAt: true,
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    return NextResponse.json({
      nota: {
        id: notaActualizada.id,
        contenido: notaActualizada.contenido,
        createdAt: notaActualizada.createdAt.toISOString(),
        updatedAt: notaActualizada.updatedAt.toISOString(),
        usuario: {
          id: notaActualizada.usuario.id,
          email: notaActualizada.usuario.email,
          nombreCompleto: `${notaActualizada.usuario.nombre} ${notaActualizada.usuario.apellido}`.trim(),
        },
      },
      message: 'Nota actualizada exitosamente',
    }, { status: 200 });
  } catch (err) {
    console.error('PATCH /api/projects/:id/notes/:noteId error:', err);
    return NextResponse.json({ error: 'Error al actualizar la nota' }, { status: 500 });
  }
}

// DELETE /api/projects/:id/notes/:noteId - Eliminar una nota
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  const projectId = Number(id);
  const notaId = Number(noteId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  if (!Number.isInteger(notaId) || notaId <= 0) {
    return NextResponse.json({ error: 'ID de nota inválido' }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que la nota existe y pertenece al proyecto
    const nota = await prisma.notaProyecto.findFirst({
      where: {
        id: notaId,
        proyectoId: projectId,
      },
      select: {
        usuarioId: true,
        proyecto: {
          select: {
            creadorId: true,
          },
        },
      },
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    // Solo el creador de la nota o un admin pueden eliminarla
    if (nota.usuarioId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar esta nota' }, { status: 403 });
    }

    // Eliminar la nota
    await prisma.notaProyecto.delete({
      where: { id: notaId },
    });

    return NextResponse.json({ message: 'Nota eliminada exitosamente' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/projects/:id/notes/:noteId error:', err);
    return NextResponse.json({ error: 'Error al eliminar la nota' }, { status: 500 });
  }
}
