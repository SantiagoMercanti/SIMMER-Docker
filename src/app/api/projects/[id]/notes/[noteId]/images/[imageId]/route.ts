// Archivo: src/app/api/projects/[id]/notes/[noteId]/images/[imageId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

// GET /api/projects/:id/notes/:noteId/images/:imageId
// Sirve los bytes de una imagen directamente como respuesta binaria
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string; imageId: string }> }
) {
  const { id, noteId, imageId } = await params;
  const projectId = Number(id);
  const notaId = Number(noteId);
  const imagenId = Number(imageId);

  if (
    !Number.isInteger(projectId) || projectId <= 0 ||
    !Number.isInteger(notaId) || notaId <= 0 ||
    !Number.isInteger(imagenId) || imagenId <= 0
  ) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar acceso al proyecto
    const proyecto = await prisma.proyecto.findUnique({
      where: { project_id: projectId },
      select: { creadorId: true },
    });

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    if (!canAccessResource(proyecto.creadorId, user)) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 });
    }

    // Obtener la imagen verificando que pertenece a la nota y al proyecto
    const imagen = await prisma.imagenNota.findFirst({
      where: {
        id: imagenId,
        notaId,
        nota: { proyectoId: projectId },
      },
      select: {
        datos: true,
        mimeType: true,
        nombre: true,
      },
    });

    if (!imagen) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }

    // ✅ Convertimos a ArrayBuffer "puro" (evita ArrayBuffer | SharedArrayBuffer)
    const bytes = imagen.datos; // Prisma Bytes -> Uint8Array (ArrayBufferLike)
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': imagen.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${imagen.nombre ?? 'imagen'}"`,
        // Cache moderado: válido 5 minutos, revalidable
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('GET /api/projects/:id/notes/:noteId/images/:imageId error:', err);
    return NextResponse.json({ error: 'Error al obtener la imagen' }, { status: 500 });
  }
}
