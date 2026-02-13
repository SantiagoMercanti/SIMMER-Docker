// Archivo: src/app/api/projects/[id]/notes/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

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

// GET /api/projects/:id/notes - Obtener todas las notas de un proyecto
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

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

    const notas = await prisma.notaProyecto.findMany({
      where: { proyectoId: projectId },
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
        // Solo metadatos, sin los bytes
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
      orderBy: { createdAt: 'desc' },
    });

    const notasFormateadas = notas.map(nota => ({
      id: nota.id,
      contenido: nota.contenido,
      createdAt: nota.createdAt.toISOString(),
      updatedAt: nota.updatedAt.toISOString(),
      usuario: {
        id: nota.usuario.id,
        email: nota.usuario.email,
        nombreCompleto: `${nota.usuario.nombre} ${nota.usuario.apellido}`.trim(),
      },
      // Las imágenes se sirven por su propia route, acá solo los metadatos + ID
      imagenes: nota.imagenes.map(img => ({
        id: img.id,
        mimeType: img.mimeType,
        nombre: img.nombre,
        tamanio: img.tamanio,
      })),
    }));

    return NextResponse.json({ notas: notasFormateadas }, { status: 200 });
  } catch (err) {
    console.error('GET /api/projects/:id/notes error:', err);
    return NextResponse.json({ error: 'Error al obtener notas' }, { status: 500 });
  }
}

// POST /api/projects/:id/notes - Crear una nueva nota (con imágenes opcionales)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

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

    const body = await req.json().catch(() => ({}));
    const { contenido, imagenes } = body;

    if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
      return NextResponse.json({ error: 'El contenido de la nota es obligatorio' }, { status: 400 });
    }

    // Validar imágenes si se enviaron
    let imagenesValidadas: ImagenInput[] = [];
    if (imagenes !== undefined && imagenes !== null) {
      const resultado = validarImagenes(imagenes);
      if (resultado === null) {
        return NextResponse.json(
          { error: `Imágenes inválidas. Máximo ${MAX_IMAGENES}, hasta 1 MB cada una, formatos: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        );
      }
      imagenesValidadas = resultado;
    }

    // Crear la nota junto con las imágenes en una sola transacción
    const nota = await prisma.notaProyecto.create({
      data: {
        proyectoId: projectId,
        usuarioId: user.id,
        contenido: contenido.trim(),
        imagenes: imagenesValidadas.length > 0
          ? {
              create: imagenesValidadas.map(img => ({
                datos: Buffer.from(img.base64, 'base64'),
                mimeType: img.mimeType,
                nombre: img.nombre,
                tamanio: Buffer.from(img.base64, 'base64').length,
              })),
            }
          : undefined,
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

    return NextResponse.json({
      nota: {
        id: nota.id,
        contenido: nota.contenido,
        createdAt: nota.createdAt.toISOString(),
        updatedAt: nota.updatedAt.toISOString(),
        usuario: {
          id: nota.usuario.id,
          email: nota.usuario.email,
          nombreCompleto: `${nota.usuario.nombre} ${nota.usuario.apellido}`.trim(),
        },
        imagenes: nota.imagenes.map(img => ({
          id: img.id,
          mimeType: img.mimeType,
          nombre: img.nombre,
          tamanio: img.tamanio,
        })),
      },
      message: 'Nota creada exitosamente',
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/:id/notes error:', err);
    return NextResponse.json({ error: 'Error al crear la nota' }, { status: 500 });
  }
}
