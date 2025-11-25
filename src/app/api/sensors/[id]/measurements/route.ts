// Ubicación: src/app/api/sensors/[id]/measurements/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MAX_MEASUREMENTS = 200;

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
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Validar sortBy
    const validSortFields = ['valor', 'timestamp', 'proyectoNombre'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortDir = sortDirection === 'asc' ? 'asc' : 'desc';

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

    // Contar total de mediciones (limitado a MAX_MEASUREMENTS para mostrar)
    const totalCount = await prisma.medicionSensor.count({
      where: whereClause,
    });

    // Limitar el total a MAX_MEASUREMENTS para la paginación
    const limitedTotalCount = Math.min(totalCount, MAX_MEASUREMENTS);
    const totalPages = Math.ceil(limitedTotalCount / pageSize);
    const skip = (page - 1) * pageSize;

    // Construir orderBy según el campo seleccionado
    let orderByClause: any;
    
    if (sortField === 'valor') {
      orderByClause = { valor: sortDir };
    } else if (sortField === 'timestamp') {
      orderByClause = { timestamp: sortDir };
    } else if (sortField === 'proyectoNombre') {
      orderByClause = { 
        proyectoSensor: { 
          proyecto: { 
            nombre: sortDir 
          } 
        } 
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
      take: Math.min(pageSize, MAX_MEASUREMENTS - skip), // No exceder MAX_MEASUREMENTS
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
        totalCount, // Total real
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
