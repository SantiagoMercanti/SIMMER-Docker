import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, requireAdmin } from '@/lib/auth';

// -------- GET /api/projects --------
// Devuelve una lista simplificada para el dashboard: [{ id: string, name: string, activo: boolean }]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (includeInactive) {
    try {
      await requireAdmin(); // solo admin puede ver inactivos
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 403;
      const msg = status === 401 ? 'No autenticado' : 'No autorizado';
      return NextResponse.json({ error: msg }, { status });
    }
  }

  try {
    const proyectos = await prisma.proyecto.findMany({
      where: includeInactive ? {} : { activo: true },
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
    // Bloquea a 'operator' (y lanza 401 si no hay sesión)
    await requireCanMutate();

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

    // Verificación opcional de existencia (fail-fast)
    if (sensorIds.length) {
      const countSens = await prisma.sensor.count({ where: { sensor_id: { in: sensorIds } } });
      if (countSens !== sensorIds.length) {
        return NextResponse.json({ error: 'Uno o más sensorIds no existen.' }, { status: 400 });
      }
    }
    if (actuatorIds.length) {
      const countActs = await prisma.actuador.count({ where: { actuator_id: { in: actuatorIds } } });
      if (countActs !== actuatorIds.length) {
        return NextResponse.json({ error: 'Uno o más actuatorIds no existen.' }, { status: 400 });
      }
    }

    // Creación del proyecto + relaciones N:M en las tablas pivote
    const nuevo = await prisma.proyecto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        sensores: {
          create: sensorIds.map((sid: number) => ({
            sensor: { connect: { sensor_id: sid } },
          })),
        },

        // Relaciones: Proyecto.actuadores -> ProyectoActuador[]
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
