// Ubicación: src/app/api/sensors/[id]/measurements/route.ts

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const MAX_MEASUREMENTS = 200;

const validSortFields = ['valor', 'timestamp', 'proyectoNombre'] as const;
type SortField = (typeof validSortFields)[number];

// GET /api/sensors/:id/measurements
// Query params: page, pageSize, projectId (opcional), sortBy, sortDirection
export async function GET(
  req: Request,
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
      return NextResponse.json(
        { error: 'Sensor no encontrado' },
        { status: 404 }
      );
    }

    if (!sensor.activo) {
      return NextResponse.json(
        { error: 'Sensor inactivo' },
        { status: 404 }
      );
    }

    // Parsear query params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number(searchParams.get('pageSize')) || 20)
    );
    const projectIdParam = searchParams.get('projectId');
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    const sortField: SortField = validSortFields.includes(
      sortBy as SortField
    )
      ? (sortBy as SortField)
      : 'timestamp';

    const sortDir: Prisma.SortOrder =
      sortDirection === 'asc' ? 'asc' : 'desc';

    // 1) Construimos el filtro del ProyectoSensor tipado
    let proyectoSensorWhere: Prisma.ProyectoSensorWhereInput = {
      sensorId,
      proyecto: { activo: true }, // solo proyectos activos
    };

    if (projectIdParam) {
      const projId = Number(projectIdParam);
      if (Number.isInteger(projId) && projId > 0) {
        proyectoSensorWhere = {
          ...proyectoSensorWhere,
          proyectoId: projId,
        };
      }
    }

    // 2) MedicionSensorWhereInput usando el filtro anterior
    const whereClause: Prisma.MedicionSensorWhereInput = {
      proyectoSensor: proyectoSensorWhere,
    };

    // Contar total de mediciones (limitado a MAX_MEASUREMENTS para mostrar)
    const totalCount = await prisma.medicionSensor.count({
      where: whereClause,
    });

    const limitedTotalCount = Math.min(totalCount, MAX_MEASUREMENTS);
    const totalPages = Math.ceil(limitedTotalCount / pageSize);
    const skip = (page - 1) * pageSize;

    // Construir orderBy según el campo seleccionado
    let orderByClause: Prisma.MedicionSensorOrderByWithRelationInput;

    if (sortField === 'valor') {
      orderByClause = { valor: sortDir };
    } else if (sortField === 'timestamp') {
      orderByClause = { timestamp: sortDir };
    } else {
      // 'proyectoNombre'
      orderByClause = {
        proyectoSensor: {
          proyecto: {
            nombre: sortDir,
          },
        },
      };
    }

    // Obtener mediciones paginadas con límite de MAX_MEASUREMENTS
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
      orderBy: orderByClause,
      skip,
      take: Math.min(pageSize, MAX_MEASUREMENTS - skip),
    });

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

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        {
          error: 'Error al obtener las mediciones',
          details: error instanceof Error ? error.message : String(error),
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
