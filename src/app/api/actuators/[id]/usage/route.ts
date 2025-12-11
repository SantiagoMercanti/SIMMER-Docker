// src/app/api/actuators/[id]/usage/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

// GET /api/actuators/:id/usage
// Retorna información sobre dónde se está usando el actuador (proyectos asociados)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actuatorId = Number(id);

  if (!Number.isInteger(actuatorId) || actuatorId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // ✅ Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ✅ Verificar que el actuador existe y el usuario puede acceder a él
    const actuador = await prisma.actuador.findUnique({
      where: { actuator_id: actuatorId },
      select: { 
        actuator_id: true, 
        creadorId: true,
        activo: true 
      },
    });

    if (!actuador) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Verificar ownership del actuador
    if (!canAccessResource(actuador.creadorId, user)) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Si el actuador está inactivo, solo admin puede ver su uso
    if (!actuador.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Buscar proyectos ACTIVOS que usan este actuador
    const rows = await prisma.proyectoActuador.findMany({
      where: {
        actuadorId: actuatorId,
        proyecto: {
          activo: true,
          // ✅ Si no es admin, solo mostrar proyectos propios
          ...(user.role !== 'admin' ? { creadorId: user.id } : {}),
        },
      },
      select: {
        proyecto: { 
          select: { 
            project_id: true, 
            nombre: true 
          } 
        },
      },
    });

    const projects = rows
      .map(r => r.proyecto)
      .filter(Boolean)
      .map(p => ({ 
        id: p!.project_id, 
        nombre: p!.nombre 
      }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error en GET /api/actuators/:id/usage:', error);
    return NextResponse.json(
      { error: 'Error al obtener el uso del actuador' },
      { status: 500 }
    );
  }
}
