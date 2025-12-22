// Ubicación: src/app/api/sensors/[id]/latest/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

// GET /api/sensors/:id/latest
// Devuelve la última medición del sensor
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sensorId = Number(id);

    if (!Number.isInteger(sensorId) || sensorId <= 0) {
      return NextResponse.json(
        { error: 'ID de sensor inválido' },
        { status: 400 }
      );
    }

    // Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el sensor existe y el usuario tiene acceso
    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: {
        sensor_id: true,
        activo: true,
        creadorId: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    });

    if (!sensor) {
      return NextResponse.json(
        { error: 'Sensor no encontrado' },
        { status: 404 }
      );
    }

    // Verificar ownership
    if (!canAccessResource(sensor.creadorId, user)) {
      return NextResponse.json(
        { error: 'Sensor no encontrado' },
        { status: 404 }
      );
    }

    // Si está inactivo, solo admin puede ver mediciones
    if (!sensor.activo && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Sensor inactivo' },
        { status: 404 }
      );
    }

    // Obtener la última medición del sensor (solo de proyectos del usuario)
    const latestMeasurement = await prisma.medicionSensor.findFirst({
      where: {
        proyectoSensor: {
          sensorId,
          proyecto: {
            activo: true,
            // Filtrar por ownership (admin ve todos)
            ...(user.role !== 'admin' ? { creadorId: user.id } : {}),
          },
        },
      },
      select: {
        id: true,
        valor: true,
        timestamp: true,
        proyectoSensor: {
          select: {
            proyecto: {
              select: {
                project_id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 1,
    });

    // Si no hay mediciones, devolver null
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

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        {
          error: 'Error al obtener la última medición',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error al obtener la última medición' },
      { status: 500 }
    );
  }
}
