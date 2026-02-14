// Archivo: src/app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser, getOwnershipFilter, getProjectFilter } from '@/lib/auth';

// -------- GET /api/projects --------
// Devuelve proyectos propios + proyectos públicos de otros usuarios.
// Los proyectos públicos ajenos se devuelven con canEdit: false para que la UI
// sepa que no puede mostrar botones de editar/eliminar.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo admin puede ver inactivos
  if (includeInactive && user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    // getProjectFilter devuelve: admin → {}, otros → { OR: [{ creadorId }, { publico: true }] }
    const projectFilter = getProjectFilter(user.id, user.role);

    const proyectos = await prisma.proyecto.findMany({
      where: {
        ...(includeInactive ? {} : { activo: true }),
        ...projectFilter,
      },
      select: {
        project_id: true,
        nombre: true,
        activo: true,
        publico: true,
        estado: true,
        creadorId: true,
      },
      orderBy: [{ activo: 'desc' }, { project_id: 'desc' }],
    });

    const items = proyectos.map((p) => ({
      id: String(p.project_id),
      name: p.nombre,
      activo: p.activo,
      publico: p.publico,
      estado: p.estado,
      canEdit: user.role === 'admin' || p.creadorId === user.id,
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
    const acting = await requireCanMutate();

    const body = await req.json().catch(() => ({}));
    const {
      nombre,
      descripcion = null,
      sensorIds = [],
      actuatorIds = [],
      publico = false,
    } = body ?? {};

    // Validaciones
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }
    if (descripcion !== null && descripcion !== undefined && typeof descripcion !== 'string') {
      return NextResponse.json({ error: 'La descripción debe ser texto o null.' }, { status: 400 });
    }
    if (!descripcion || typeof descripcion !== 'string' || !descripcion.trim()) {
      return NextResponse.json({ error: 'La descripción es obligatoria.' }, { status: 400 });
    }
    if (!Array.isArray(sensorIds) || !sensorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'sensorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (!Array.isArray(actuatorIds) || !actuatorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'actuatorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (sensorIds.length === 0 && actuatorIds.length === 0) {
      return NextResponse.json({ error: 'Debe seleccionar al menos un sensor o actuador.' }, { status: 400 });
    }
    if (typeof publico !== 'boolean') {
      return NextResponse.json({ error: 'publico debe ser booleano.' }, { status: 400 });
    }

    // Verificar ownership de sensores y actuadores
    if (sensorIds.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countSens = await prisma.sensor.count({
        where: { sensor_id: { in: sensorIds }, ...ownershipFilter },
      });
      if (countSens !== sensorIds.length) {
        return NextResponse.json({ error: 'Uno o más sensores no existen o no te pertenecen.' }, { status: 400 });
      }
    }
    if (actuatorIds.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countActs = await prisma.actuador.count({
        where: { actuator_id: { in: actuatorIds }, ...ownershipFilter },
      });
      if (countActs !== actuatorIds.length) {
        return NextResponse.json({ error: 'Uno o más actuadores no existen o no te pertenecen.' }, { status: 400 });
      }
    }

    const nuevo = await prisma.proyecto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        creadorId: acting.id,
        publico,
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
      select: { project_id: true, nombre: true, publico: true, estado: true },
    });

    return NextResponse.json(
      { id: String(nuevo.project_id), name: nuevo.nombre, publico: nuevo.publico, estado: nuevo.estado, message: 'Proyecto creado' },
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
