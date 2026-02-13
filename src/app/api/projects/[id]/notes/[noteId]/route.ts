// Archivo: src/app/api/projects/[id]/notes/[noteId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const MAX_IMAGENES = 3;
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB por imagen
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type ImagenInput = {
  base64: string;
  mimeType: string;
  nombre: string;
};

function validarImagenes(imagenes: unknown): ImagenInput[] | null {
  if (!Array.isArray(imagenes)) return null;
  if (imagenes.length > MAX_IMAGENES) return null;

  for (const img of imagenes) {
    if (typeof img !== 'object' || img === null) return null;
    const { base64, mimeType, nombre } = img as Record<string, unknown>;

    if (typeof base64 !== 'string' || !base64.trim()) return null;
    if (typeof mimeType !== 'string' || !MIME_PERMITIDOS.includes(mimeType)) return null;
    if (typeof nombre !== 'string') return null;

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BYTES) return null;
  }

  return imagenes as ImagenInput[];
}

// PATCH /api/projects/:id/notes/:noteId - Actualizar una nota
// Body: { contenido?: string, imagenes?: ImagenInput[] | null }
// - Si `imagenes` no se envía: las imágenes existentes no se tocan
// - Si `imagenes` es un array (vacío o con elementos): reemplaza TODAS las imágenes
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

    const nota = await prisma.notaProyecto.findFirst({
      where: { id: notaId, proyectoId: projectId },
      select: { usuarioId: true },
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    if (nota.usuarioId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para editar esta nota' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { contenido, imagenes } = body;

    if (contenido !== undefined) {
      if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
        return NextResponse.json({ error: 'El contenido de la nota es obligatorio' }, { status: 400 });
      }
    }

    // Validar imágenes solo si se enviaron en el body
    let imagenesValidadas: ImagenInput[] | null = null;
    if (imagenes !== undefined) {
      // imagenes: [] significa "borrar todas las imágenes"
      // imagenes: null significa lo mismo
      if (imagenes === null || (Array.isArray(imagenes) && imagenes.length === 0)) {
        imagenesValidadas = [];
      } else {
        const resultado = validarImagenes(imagenes);
        if (resultado === null) {
          return NextResponse.json(
            { error: `Imágenes inválidas. Máximo ${MAX_IMAGENES}, hasta 1 MB cada una, formatos: JPEG, PNG, WebP, GIF` },
            { status: 400 }
          );
        }
        imagenesValidadas = resultado;
      }
    }

    // Ejecutar la actualización en una transacción
    const notaActualizada = await prisma.$transaction(async (tx) => {
      // Si se enviaron imágenes, reemplazar todas las existentes
      if (imagenesValidadas !== null) {
        await tx.imagenNota.deleteMany({ where: { notaId } });

        if (imagenesValidadas.length > 0) {
          await tx.imagenNota.createMany({
            data: imagenesValidadas.map(img => ({
              notaId,
              datos: Buffer.from(img.base64, 'base64'),
              mimeType: img.mimeType,
              nombre: img.nombre,
              tamanio: Buffer.from(img.base64, 'base64').length,
            })),
          });
        }
      }

      return tx.notaProyecto.update({
        where: { id: notaId },
        data: {
          ...(contenido !== undefined ? { contenido: contenido.trim() } : {}),
        },
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
          imagenes: {
            select: {
              id: true,
              mimeType: true,
              nombre: true,
              tamanio: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
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
        imagenes: notaActualizada.imagenes.map(img => ({
          id: img.id,
          mimeType: img.mimeType,
          nombre: img.nombre,
          tamanio: img.tamanio,
        })),
      },
      message: 'Nota actualizada exitosamente',
    }, { status: 200 });
  } catch (err) {
    console.error('PATCH /api/projects/:id/notes/:noteId error:', err);
    return NextResponse.json({ error: 'Error al actualizar la nota' }, { status: 500 });
  }
}

// DELETE /api/projects/:id/notes/:noteId - Eliminar una nota (las imágenes se borran por Cascade)
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

    const nota = await prisma.notaProyecto.findFirst({
      where: { id: notaId, proyectoId: projectId },
      select: { usuarioId: true },
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    if (nota.usuarioId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar esta nota' }, { status: 403 });
    }

    // Las ImagenNota se eliminan automáticamente por onDelete: Cascade
    await prisma.notaProyecto.delete({ where: { id: notaId } });

    return NextResponse.json({ message: 'Nota eliminada exitosamente' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/projects/:id/notes/:noteId error:', err);
    return NextResponse.json({ error: 'Error al eliminar la nota' }, { status: 500 });
  }
}
