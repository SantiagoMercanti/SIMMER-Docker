import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser, getOwnershipFilter } from '@/lib/auth';

// -------- GET /api/projects --------
// Devuelve una lista simplificada para el dashboard: [{ id: string, name: string, activo: boolean }]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  // Requiere autenticación
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo admin puede ver inactivos
  if (includeInactive && user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    // Obtener filtro de ownership según el rol del usuario
    const ownershipFilter = getOwnershipFilter(user.id, user.role);

    const proyectos = await prisma.proyecto.findMany({
      where: {
        ...(includeInactive ? {} : { activo: true }),
        ...ownershipFilter, // Filtra por creadorId (excepto admin)
      },
      select: {
        project_id: true,
        nombre: true,
        activo: true,
      },
      orderBy: [{ activo: 'desc' }, { project_id: 'desc' }],
    });

    const items = proyectos.map((p) => ({
      id: String(p.project_id),
      name: p.nombre,
      activo: p.activo,
    }));

    return NextResponse.json(items, { status: 200 });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  }
}

// -------- POST /api/projects --------
export async function POST(req: Request) {
  try {
    // Bloquea a 'operator' y obtiene el usuario autenticado
    const acting = await requireCanMutate();

    const body = await req.json().catch(() => ({}));
    const {
      nombre,
      descripcion = null,
      sensorIds = [],
      actuatorIds = [],
    } = body ?? {};

    // Validaciones mínimas
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }
    if (descripcion !== null && descripcion !== undefined && typeof descripcion !== 'string') {
      return NextResponse.json({ error: 'La descripción debe ser texto o null.' }, { status: 400 });
    }
    // Validar que descripción no esté vacía
    if (!descripcion || typeof descripcion !== 'string' || !descripcion.trim()) {
      return NextResponse.json({ error: 'La descripción es obligatoria.' }, { status: 400 });
    }
    if (!Array.isArray(sensorIds) || !sensorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'sensorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (!Array.isArray(actuatorIds) || !actuatorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'actuatorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }

    // Validar que haya al menos un sensor o actuador
    if (sensorIds.length === 0 && actuatorIds.length === 0) {
      return NextResponse.json({ error: 'Debe seleccionar al menos un sensor o actuador.' }, { status: 400 });
    }

    // Verificar ownership de sensores y actuadores
    if (sensorIds.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countSens = await prisma.sensor.count({ 
        where: { 
          sensor_id: { in: sensorIds },
          ...ownershipFilter,
        } 
      });
      if (countSens !== sensorIds.length) {
        return NextResponse.json({ 
          error: 'Uno o más sensores no existen o no te pertenecen.' 
        }, { status: 400 });
      }
    }
    if (actuatorIds.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countActs = await prisma.actuador.count({ 
        where: { 
          actuator_id: { in: actuatorIds },
          ...ownershipFilter,
        } 
      });
      if (countActs !== actuatorIds.length) {
        return NextResponse.json({ 
          error: 'Uno o más actuadores no existen o no te pertenecen.' 
        }, { status: 400 });
      }
    }

    // Creación del proyecto + relaciones N:M en las tablas pivote
    const nuevo = await prisma.proyecto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        creadorId: acting.id, // ASIGNAR EL CREADOR
        sensores: {
          create: sensorIds.map((sid: number) => ({
            sensor: { connect: { sensor_id: sid } },
          })),
        },
        actuadores: {
          create: actuatorIds.map((aid: number) => ({
            actuador: { connect: { actuator_id: aid } },
          })),
        },
      },
      select: {
        project_id: true,
        nombre: true,
      },
    });

    return NextResponse.json(
      {
        id: String(nuevo.project_id),
        name: nuevo.nombre,
        message: 'Proyecto creado',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para crear proyectos' }, { status });

    console.error('POST /api/projects error:', err);
    return NextResponse.json({ error: 'No se pudo crear el proyecto' }, { status });
  }
}
