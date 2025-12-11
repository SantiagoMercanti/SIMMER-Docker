// Ubicación: src/app/api/sensors/[id]/usage/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

// GET /api/sensors/:id/usage
// Retorna la lista de proyectos activos que usan este sensor
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sensorId = Number(id);

  if (!Number.isInteger(sensorId) || sensorId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // ✅ Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ✅ Verificar que el sensor existe y el usuario puede acceder a él
    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: { 
        sensor_id: true, 
        creadorId: true,
        activo: true 
      },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // ✅ Verificar ownership del sensor
    if (!canAccessResource(sensor.creadorId, user)) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // ✅ Si el sensor está inactivo, solo admin puede ver su uso
    if (!sensor.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // ✅ Filtrar proyectos por ownership (admin ve todos)
    const rows = await prisma.proyectoSensor.findMany({
      where: {
        sensorId,
        proyecto: {
          activo: true,
          // Si no es admin, solo mostrar proyectos propios
          ...(user.role !== 'admin' ? { creadorId: user.id } : {}),
        },
      },
      select: {
        proyecto: { select: { project_id: true, nombre: true } },
      },
    });

    const projects = rows
      .map(r => r.proyecto)
      .filter(Boolean)
      .map(p => ({ id: p!.project_id, nombre: p!.nombre }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error al obtener proyectos del sensor:', error);
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    );
  }
}
