import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate } from '@/lib/auth'; // ⟵ nuevo

// GET /api/projects/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const proj = await prisma.proyecto.findUnique({
      where: { project_id: projectId },
      include: {
        // Para el form (ya lo tenías)
        sensores: { select: { sensorId: true, sensor: { select: { sensor_id: true, nombre: true, unidad_de_medida: true } } } },
        actuadores: { select: { actuadorId: true, actuador: { select: { actuator_id: true, nombre: true, unidad_de_medida: true } } } },
      },
    });

    if (!proj) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Compat form
    const sensorIds = proj.sensores.map(s => s.sensorId);
    const actuatorIds = proj.actuadores.map(a => a.actuadorId);

    // Datos para el modal
    const sensors = proj.sensores
      .map(s => s.sensor)
      .filter(Boolean)
      .map(s => ({
        id: s!.sensor_id,
        nombre: s!.nombre,
        unidadMedida: s!.unidad_de_medida ?? '',
      }));

    const actuators = proj.actuadores
      .map(a => a.actuador)
      .filter(Boolean)
      .map(a => ({
        id: a!.actuator_id,
        nombre: a!.nombre,
        unidadMedida: a!.unidad_de_medida ?? '',
      }));
    return NextResponse.json(
      {
        id: proj.project_id,
        nombre: proj.nombre,
        descripcion: proj.descripcion ?? '',
        // Para el form:
        sensorIds,
        actuatorIds,
        // Para el modal:
        sensors,
        actuators,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('GET /api/projects/:id error:', err);
    return NextResponse.json({ error: 'Error al obtener el proyecto' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/:id
 * Body:
 * {
 *   nombre: string;
 *   descripcion?: string | null;
 *   sensorIds?: number[];
 *   actuatorIds?: number[];
 * }
 * Actualiza el proyecto y REEMPLAZA sus relaciones N:M (borra y vuelve a crear pivotes).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // Bloquea a 'operator' y lanza 401 si no hay sesión
    await requireCanMutate();

    const body = await req.json().catch(() => ({}));
    const {
      nombre,
      descripcion = null,
      sensorIds = [],
      actuatorIds = [],
    } = body ?? {};

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

    // Validaciones opcionales de existencia
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

    // Transacción: update + reset pivotes
    const updated = await prisma.$transaction(async (tx) => {
      // Asegurar existencia
      const exists = await tx.proyecto.findUnique({ where: { project_id: projectId }, select: { project_id: true } });
      if (!exists) throw new Error('NOT_FOUND');

      await tx.proyecto.update({
        where: { project_id: projectId },
        data: {
          nombre: nombre.trim(),
          descripcion: descripcion?.trim?.() ?? null,
        },
      });

      // Borrar pivotes actuales
      await tx.proyectoSensor.deleteMany({ where: { proyectoId: projectId } });
      await tx.proyectoActuador.deleteMany({ where: { proyectoId: projectId } });

      // Crear pivotes nuevos
      if (sensorIds.length) {
        await tx.proyectoSensor.createMany({
          data: sensorIds.map((sid: number) => ({ proyectoId: projectId, sensorId: sid })),
          skipDuplicates: true,
        });
      }
      if (actuatorIds.length) {
        await tx.proyectoActuador.createMany({
          data: actuatorIds.map((aid: number) => ({ proyectoId: projectId, actuadorId: aid })),
          skipDuplicates: true,
        });
      }

      return tx.proyecto.findUnique({
        where: { project_id: projectId },
        select: { project_id: true, nombre: true },
      });
    });

    return NextResponse.json(
      { id: String(updated?.project_id), name: updated?.nombre, message: 'Proyecto actualizado' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para editar proyectos' }, { status });

    if (typeof err === 'object' && err !== null && 'message' in err && (err as { message?: string }).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }
    console.error('PATCH /api/projects/:id error:', err);
    return NextResponse.json({ error: 'No se pudo actualizar el proyecto' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/:id
 * Borra el proyecto. Con tu schema (onDelete: Cascade en pivotes) se eliminan también
 * las filas de ProyectoSensor y ProyectoActuador automáticamente.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // Bloquea a 'operator' y lanza 401 si no hay sesión
    await requireCanMutate();

    await prisma.proyecto.delete({ where: { project_id: projectId } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para eliminar proyectos' }, { status });

    // Si no existe, devolver 404
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }
    console.error('DELETE /api/projects/:id error:', err);
    return NextResponse.json({ error: 'No se pudo eliminar el proyecto' }, { status: 500 });
  }
}
