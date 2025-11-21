// Ubicación: src/app/api/sensors/[id]/measurements/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/sensors/:id/measurements
// Query params: page, pageSize, projectId (opcional)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sensorId = Number(id);

    if (!Number.isInteger(sensorId) || sensorId <= 0) {
      return NextResponse.json({ error: 'ID de sensor inválido' }, { status: 400 });
    }

    // Verificar que el sensor existe y está activo
    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: {
        sensor_id: true,
        nombre: true,
        activo: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    if (!sensor.activo) {
      return NextResponse.json({ error: 'Sensor inactivo' }, { status: 404 });
    }

    // Parsear query params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize')) || 20));
    const projectIdParam = searchParams.get('projectId');

    // Construir filtros
    const whereClause: {
      proyectoSensor: {
        sensorId: number;
        proyectoId?: number;
        proyecto?: { is: { activo: boolean } };
      };
    } = {
      proyectoSensor: {
        sensorId,
        proyecto: { is: { activo: true } }, // Solo proyectos activos
      },
    };

    // Filtro opcional por proyecto
    if (projectIdParam) {
      const projId = Number(projectIdParam);
      if (Number.isInteger(projId) && projId > 0) {
        whereClause.proyectoSensor.proyectoId = projId;
      }
    }

    // Contar total de mediciones
    const totalCount = await prisma.medicionSensor.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalCount / pageSize);
    const skip = (page - 1) * pageSize;

    // Obtener mediciones paginadas
    const measurements = await prisma.medicionSensor.findMany({
      where: whereClause,
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
        timestamp: 'desc', // Más recientes primero
      },
      skip,
      take: pageSize,
    });

    // Formatear respuesta
    const formattedMeasurements = measurements.map((m) => ({
      id: m.id,
      valor: m.valor,
      timestamp: m.timestamp.toISOString(),
      proyectoNombre: m.proyectoSensor.proyecto.nombre,
      proyectoId: m.proyectoSensor.proyecto.project_id,
      unidadSimbolo: sensor.unidadMedida?.simbolo ?? '',
    }));

    return NextResponse.json({
      measurements: formattedMeasurements,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      sensorNombre: sensor.nombre,
    });
  } catch (error) {
    console.error('Error al obtener mediciones:', error);
    
    // Enviar detalles del error en desarrollo
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Error al obtener las mediciones',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al obtener las mediciones' },
      { status: 500 }
    );
  }
}
