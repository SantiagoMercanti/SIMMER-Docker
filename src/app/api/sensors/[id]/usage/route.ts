// Archivo: src/app/api/sensors/[id]/usage/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessSensor } from '@/lib/auth';

// GET /api/sensors/:id/usage
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: { sensor_id: true, creadorId: true, activo: true },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Verificar acceso: creador, admin, o sensor en proyecto público
    const tieneAcceso = await canAccessSensor(
      { creadorId: sensor.creadorId },
      user,
      sensorId,
      prisma
    );
    if (!tieneAcceso) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    if (!sensor.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Para usuarios ajenos al sensor, solo mostrar proyectos públicos
    const esPropietarioOAdmin = user.role === 'admin' || sensor.creadorId === user.id;

    const rows = await prisma.proyectoSensor.findMany({
      where: {
        sensorId,
        proyecto: {
          activo: true,
          ...(esPropietarioOAdmin ? {} : { publico: true }),
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
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  }
}
