import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MAX_RECORDS = 200;

// GET /api/actuators/:id/records
// Query params: page, pageSize, projectId (opcional), usuarioId (opcional), sortBy, sortDirection
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actuadorId = Number(id);

    if (!Number.isInteger(actuadorId) || actuadorId <= 0) {
      return NextResponse.json({ error: 'ID de actuador inválido' }, { status: 400 });
    }

    // Verificar que el actuador existe y está activo
    const actuador = await prisma.actuador.findUnique({
      where: { actuator_id: actuadorId },
      select: {
        actuator_id: true,
        nombre: true,
        activo: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    });

    if (!actuador) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    if (!actuador.activo) {
      return NextResponse.json({ error: 'Actuador inactivo' }, { status: 404 });
    }

    // Parsear query params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize')) || 20));
    const projectIdParam = searchParams.get('projectId');
    const usuarioIdParam = searchParams.get('usuarioId');
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Validar sortBy
    const validSortFields = ['valor', 'timestamp', 'proyectoNombre', 'usuarioEmail'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortDir = sortDirection === 'asc' ? 'asc' : 'desc';

    // Construir filtros
    const whereClause: {
      proyectoActuador: {
        actuadorId: number;
        proyectoId?: number;
        proyecto?: { is: { activo: boolean } };
      };
      usuarioId?: string | null;
    } = {
      proyectoActuador: {
        actuadorId,
        proyecto: { is: { activo: true } }, // Solo proyectos activos
      },
    };

    // Filtro opcional por proyecto
    if (projectIdParam) {
      const projId = Number(projectIdParam);
      if (Number.isInteger(projId) && projId > 0) {
        whereClause.proyectoActuador.proyectoId = projId;
      }
    }

    // Filtro opcional por usuario
    if (usuarioIdParam) {
      if (usuarioIdParam === 'null') {
        whereClause.usuarioId = null; // Registros sin usuario asignado
      } else {
        whereClause.usuarioId = usuarioIdParam;
      }
    }

    // Contar total de registros
    const totalCount = await prisma.registroActuador.count({
      where: whereClause,
    });

    // Limitar el total a MAX_RECORDS para la paginación
    const limitedTotalCount = Math.min(totalCount, MAX_RECORDS);
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
        proyectoActuador: { 
          proyecto: { 
            nombre: sortDir 
          } 
        } 
      };
    } else if (sortField === 'usuarioEmail') {
      orderByClause = { 
        usuario: { 
          email: sortDir 
        } 
      };
    }

    // Obtener registros paginados con límite de MAX_RECORDS
    const records = await prisma.registroActuador.findMany({
      where: whereClause,
      select: {
        id: true,
        valor: true,
        timestamp: true,
        proyectoActuador: {
          select: {
            proyecto: {
              select: {
                project_id: true,
                nombre: true,
              },
            },
          },
        },
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: orderByClause,
      skip,
      take: Math.min(pageSize, MAX_RECORDS - skip),
    });

    // Formatear respuesta
    const formattedRecords = records.map((r) => ({
      id: r.id,
      valor: r.valor,
      timestamp: r.timestamp.toISOString(),
      proyectoNombre: r.proyectoActuador.proyecto.nombre,
      proyectoId: r.proyectoActuador.proyecto.project_id,
      unidadSimbolo: actuador.unidadMedida?.simbolo ?? '',
      usuario: r.usuario ? {
        id: r.usuario.id,
        email: r.usuario.email,
        nombre: r.usuario.nombre,
        apellido: r.usuario.apellido,
      } : null,
    }));

    return NextResponse.json({
      records: formattedRecords,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      actuadorNombre: actuador.nombre,
    });
  } catch (error) {
    console.error('Error al obtener registros:', error);
    
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Error al obtener los registros',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al obtener los registros' },
      { status: 500 }
    );
  }
}
