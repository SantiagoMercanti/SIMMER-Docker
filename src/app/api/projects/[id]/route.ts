import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, requireAdmin } from '@/lib/auth';

// GET /api/projects/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intId = Number(id);
  if (!Number.isInteger(intId) || intId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // Traemos el proyecto y solo las relaciones activas
  const p = await prisma.proyecto.findUnique({
    where: { project_id: intId },
    select: {
      project_id: true,
      nombre: true,
      descripcion: true,

      // Solo sensores ACTIVOS vinculados
      sensores: {
        where: { sensor: { is: { activo: true } } },
        select: {
          sensor: {
            select: {
              sensor_id: true,
              nombre: true,
              unidad_medida_id: true,  // ← ID de la unidad
              unidadMedida: {           // ← Relación completa
                select: {
                  id: true,
                  nombre: true,
                  simbolo: true,
                  categoria: true,
                }
              },
            },
          },
        },
      },

      // Solo actuadores ACTIVOS vinculados
      actuadores: {
        where: { actuador: { is: { activo: true } } },
        select: {
          actuador: {
            select: {
              actuator_id: true,
              nombre: true,
              unidad_medida_id: true,  // ← ID de la unidad
              unidadMedida: {           // ← Relación completa
                select: {
                  id: true,
                  nombre: true,
                  simbolo: true,
                  categoria: true,
                }
              },
            },
          },
        },
      },
    },
  });

  if (!p) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  // Normalizamos al formato que el modal espera
  const sensors = p.sensores.map((x) => ({
    id: x.sensor.sensor_id,
    nombre: x.sensor.nombre,
    unidadMedida: x.sensor.unidadMedida?.simbolo ?? '',  // ← Símbolo de la unidad
    unidadNombre: x.sensor.unidadMedida?.nombre,         // ← Opcional: nombre completo
  }));

  const actuators = p.actuadores.map((x) => ({
    id: x.actuador.actuator_id,
    nombre: x.actuador.nombre,
    unidadMedida: x.actuador.unidadMedida?.simbolo ?? '',
    unidadNombre: x.actuador.unidadMedida?.nombre,
  }));

  return NextResponse.json({
    project_id: p.project_id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    sensors,
    actuators,
  });
}

// PATCH /api/projects/:id
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
      descripcion,
      sensorIds,
      actuatorIds,
      activo,
    } = body ?? {};

    // Validaciones
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }
    if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
      return NextResponse.json({ error: 'La descripción debe ser texto o null.' }, { status: 400 });
    }
    // Validar que descripción no esté vacía si se proporciona
    if (descripcion !== undefined && (!descripcion || typeof descripcion !== 'string' || !descripcion.trim())) {
      return NextResponse.json({ error: 'La descripción es obligatoria.' }, { status: 400 });
    }
    if (sensorIds !== undefined && (!Array.isArray(sensorIds) || !sensorIds.every((n: number) => Number.isInteger(n) && n > 0))) {
      return NextResponse.json({ error: 'sensorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (actuatorIds !== undefined && (!Array.isArray(actuatorIds) || !actuatorIds.every((n: number) => Number.isInteger(n) && n > 0))) {
      return NextResponse.json({ error: 'actuatorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }

    // Validar que haya al menos un sensor o actuador (si se están actualizando)
    if (sensorIds !== undefined && actuatorIds !== undefined) {
      if (sensorIds.length === 0 && actuatorIds.length === 0) {
        return NextResponse.json({ error: 'Debe tener al menos un sensor o actuador.' }, { status: 400 });
      }
    }

    // Reactivación (solo admin)
    if (activo !== undefined) {
      if (activo === true) {
        try {
          await requireAdmin();
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status ?? 403;
          const msg = status === 401 ? 'No autenticado' : 'Solo admin puede reactivar proyectos';
          return NextResponse.json({ error: msg }, { status });
        }
      } else if (activo === false) {
        return NextResponse.json({ error: 'Para desactivar use DELETE /api/projects/:id' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 });
      }
    }

    // Validaciones opcionales de existencia
    if (sensorIds && sensorIds.length) {
      const countSens = await prisma.sensor.count({ where: { sensor_id: { in: sensorIds } } });
      if (countSens !== sensorIds.length) {
        return NextResponse.json({ error: 'Uno o más sensorIds no existen.' }, { status: 400 });
      }
    }
    if (actuatorIds && actuatorIds.length) {
      const countActs = await prisma.actuador.count({ where: { actuator_id: { in: actuatorIds } } });
      if (countActs !== actuatorIds.length) {
        return NextResponse.json({ error: 'Uno o más actuatorIds no existen.' }, { status: 400 });
      }
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (activo !== undefined) updateData.activo = activo;

    // Transacción: update + reset pivotes (solo si se enviaron)
    const updated = await prisma.$transaction(async (tx) => {
      // Asegurar existencia
      const exists = await tx.proyecto.findUnique({ where: { project_id: projectId }, select: { project_id: true } });
      if (!exists) throw new Error('NOT_FOUND');

      // Actualizar campos básicos
      if (Object.keys(updateData).length > 0) {
        await tx.proyecto.update({
          where: { project_id: projectId },
          data: updateData,
        });
      }

      // Si se enviaron relaciones, reemplazarlas
      if (sensorIds !== undefined) {
        await tx.proyectoSensor.deleteMany({ where: { proyectoId: projectId } });
        if (sensorIds.length) {
          await tx.proyectoSensor.createMany({
            data: sensorIds.map((sid: number) => ({ proyectoId: projectId, sensorId: sid })),
            skipDuplicates: true,
          });
        }
      }

      if (actuatorIds !== undefined) {
        await tx.proyectoActuador.deleteMany({ where: { proyectoId: projectId } });
        if (actuatorIds.length) {
          await tx.proyectoActuador.createMany({
            data: actuatorIds.map((aid: number) => ({ proyectoId: projectId, actuadorId: aid })),
            skipDuplicates: true,
          });
        }
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
 * Soft-delete: marca activo=false
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

    await prisma.proyecto.update({
      where: { project_id: projectId },
      data: { activo: false }, // soft-delete
    });
    return NextResponse.json({ ok: true });
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
