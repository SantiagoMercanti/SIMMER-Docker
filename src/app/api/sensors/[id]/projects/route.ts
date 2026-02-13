// Ubicación: src/app/api/sensors/[id]/projects/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessSensor } from '@/lib/auth';

// GET /api/sensors/:id/projects
// Retorna la lista de proyectos activos que tienen mediciones de este sensor
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

    // Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el sensor existe y el usuario puede acceder a él
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

    // Si el sensor está inactivo, solo admin puede ver sus proyectos
    if (!sensor.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Para usuarios ajenos al sensor, solo mostrar proyectos públicos
    const esPropietarioOAdmin = user.role === 'admin' || sensor.creadorId === user.id;

    // Obtener proyectos únicos que tienen mediciones de este sensor
    const projects = await prisma.proyectoSensor.findMany({
      where: {
        sensorId,
        proyecto: {
          activo: true,
          ...(esPropietarioOAdmin ? {} : { publico: true }),
        },
        mediciones: {
          some: {}, // Solo proyectos que tienen al menos una medición
        },
      },
      select: {
        proyecto: {
          select: {
            project_id: true,
            nombre: true,
          },
        },
      },
      distinct: ['proyectoId'],
      orderBy: {
        proyecto: {
          nombre: 'asc',
        },
      },
    });

    const formattedProjects = projects.map((ps) => ({
      id: ps.proyecto.project_id,
      nombre: ps.proyecto.nombre,
    }));

    return NextResponse.json({
      projects: formattedProjects,
    });
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Error al obtener proyectos',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    );
  }
}
