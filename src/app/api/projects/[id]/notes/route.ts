// Archivo: src/app/api/projects/[id]/notes/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

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

    // Verificar que el proyecto existe y el usuario tiene acceso
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

    // Obtener las notas
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
    }));

    return NextResponse.json({ notas: notasFormateadas }, { status: 200 });
  } catch (err) {
    console.error('GET /api/projects/:id/notes error:', err);
    return NextResponse.json({ error: 'Error al obtener notas' }, { status: 500 });
  }
}

// POST /api/projects/:id/notes - Crear una nueva nota
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

    // Verificar que el proyecto existe y el usuario tiene acceso
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
    const { contenido } = body;

    if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
      return NextResponse.json({ error: 'El contenido de la nota es obligatorio' }, { status: 400 });
    }

    // Crear la nota
    const nota = await prisma.notaProyecto.create({
      data: {
        proyectoId: projectId,
        usuarioId: user.id,
        contenido: contenido.trim(),
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
      },
      message: 'Nota creada exitosamente',
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/:id/notes error:', err);
    return NextResponse.json({ error: 'Error al crear la nota' }, { status: 500 });
  }
}
