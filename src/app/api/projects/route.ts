import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// -------- GET /api/projects --------
// Devuelve una lista simplificada para el dashboard: [{ id: string, name: string }]
export async function GET() {
  try {
    const proyectos = await prisma.proyecto.findMany({
      select: {
        project_id: true,
        nombre: true,
      },
      orderBy: { project_id: 'desc' },
    });

    const items = proyectos.map((p) => ({
      id: String(p.project_id),
      name: p.nombre,
    }));

    return NextResponse.json(items, { status: 200 });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  }
}

// -------- POST /api/projects --------
// Body esperado:
// {
//   "nombre": string,
//   "descripcion": string | null,
//   "sensorIds": number[],
//   "actuatorIds": number[]
// }
export async function POST(req: Request) {
  try {
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
    if (!Array.isArray(sensorIds) || !sensorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'sensorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (!Array.isArray(actuatorIds) || !actuatorIds.every((n: number) => Number.isInteger(n) && n > 0)) {
      return NextResponse.json({ error: 'actuatorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }

    // Opcional: verificar existencia previa de sensores/actuadores para dar mejor error
    // (si te gusta el comportamiento "fail-fast")
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

    // Creación del proyecto + relaciones N:M usando las tablas pivote explícitas
    const nuevo = await prisma.proyecto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() ?? null,

        // Relaciones: Proyecto.sensores -> ProyectoSensor[]
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
  } catch (err) {
    console.error('POST /api/projects error:', err);

    // Prisma codes útiles (por si preferís mensajes más específicos)
    // if (err?.code === 'P2003') { ... } // foreign key
    // if (err?.code === 'P2002') { ... } // unique
    return NextResponse.json({ error: 'No se pudo crear el proyecto' }, { status: 500 });
  }
}
