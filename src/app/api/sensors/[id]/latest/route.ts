// Archivo: src/app/api/sensors/[id]/latest/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessSensor } from '@/lib/auth';

// GET /api/sensors/:id/latest
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sensorId = Number(id);

    if (!Number.isInteger(sensorId) || sensorId <= 0) {
      return NextResponse.json({ error: 'ID de sensor inválido' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: {
        sensor_id: true,
        activo: true,
        creadorId: true,
        unidadMedida: { select: { simbolo: true } },
      },
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
      return NextResponse.json({ error: 'Sensor inactivo' }, { status: 404 });
    }

    // Para usuarios ajenos al sensor, solo mostrar mediciones de proyectos públicos
    const esPropietarioOAdmin = user.role === 'admin' || sensor.creadorId === user.id;

    const latestMeasurement = await prisma.medicionSensor.findFirst({
      where: {
        proyectoSensor: {
          sensorId,
          proyecto: {
            activo: true,
            ...(esPropietarioOAdmin
              ? {} // dueño/admin ven todas
              : { publico: true }), // visitante solo ve las de proyectos públicos
          },
        },
      },
      select: {
        id: true,
        valor: true,
        timestamp: true,
        proyectoSensor: {
          select: {
            proyecto: { select: { project_id: true, nombre: true } },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });

    if (!latestMeasurement) {
      return NextResponse.json({
        latestMeasurement: null,
        unidadSimbolo: sensor.unidadMedida?.simbolo ?? '',
      });
    }

    return NextResponse.json({
      latestMeasurement: {
        id: latestMeasurement.id,
        valor: latestMeasurement.valor,
        timestamp: latestMeasurement.timestamp.toISOString(),
        proyectoId: latestMeasurement.proyectoSensor.proyecto.project_id,
        proyectoNombre: latestMeasurement.proyectoSensor.proyecto.nombre,
      },
      unidadSimbolo: sensor.unidadMedida?.simbolo ?? '',
    });
  } catch (error) {
    console.error('Error al obtener última medición:', error);
    return NextResponse.json({ error: 'Error al obtener la última medición' }, { status: 500 });
  }
}
