// Archivo: src/app/api/projects/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser, getOwnershipFilter, canAccessProject, canModifyResource } from '@/lib/auth';

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

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const p = await prisma.proyecto.findUnique({
    where: { project_id: intId },
    select: {
      project_id: true,
      nombre: true,
      descripcion: true,
      creadorId: true,
      publico: true,

      creador: {
        select: { email: true, nombre: true, apellido: true },
      },

      sensores: {
        where: { sensor: { is: { activo: true } } },
        select: {
          sensor: {
            select: {
              sensor_id: true,
              nombre: true,
              unidadMedida: {
                select: { id: true, nombre: true, simbolo: true, categoria: true },
              },
            },
          },
          mediciones: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { valor: true, timestamp: true },
          },
        },
      },

      actuadores: {
        where: { actuador: { is: { activo: true } } },
        select: {
          actuador: {
            select: {
              actuator_id: true,
              nombre: true,
              unidadMedida: {
                select: { id: true, nombre: true, simbolo: true, categoria: true },
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

  // Verificar acceso: dueño, admin, o proyecto público
  if (!canAccessProject({ creadorId: p.creadorId, publico: p.publico }, user)) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  const sensors = p.sensores.map((x) => {
    const ultimaMedicion = x.mediciones[0];
    return {
      id: x.sensor.sensor_id,
      nombre: x.sensor.nombre,
      unidadMedida: x.sensor.unidadMedida?.simbolo ?? '',
      unidadNombre: x.sensor.unidadMedida?.nombre,
      ultimoValor: ultimaMedicion?.valor ?? null,
      ultimaFecha: ultimaMedicion?.timestamp ?? null,
    };
  });

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
    publico: p.publico,
    // canEdit: true solo si es el dueño o admin
    canEdit: user.role === 'admin' || p.creadorId === user.id,
    sensors,
    actuators,
    sensorIds: sensors.map((s) => s.id),
    actuatorIds: actuators.map((a) => a.id),
    creador: p.creador
      ? {
          email: p.creador.email,
          nombreCompleto: `${p.creador.nombre} ${p.creador.apellido}`.trim(),
        }
      : null,
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
    const acting = await requireCanMutate();

    const existing = await prisma.proyecto.findUnique({
      where: { project_id: projectId },
      select: { creadorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    if (!canModifyResource(existing.creadorId, acting)) {
      return NextResponse.json({ error: 'No tienes permisos para editar este proyecto' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { nombre, descripcion, sensorIds, actuatorIds, activo, publico } = body ?? {};

    // Validaciones
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }
    if (descripcion !== undefined && (!descripcion || typeof descripcion !== 'string' || !descripcion.trim())) {
      return NextResponse.json({ error: 'La descripción es obligatoria.' }, { status: 400 });
    }
    if (sensorIds !== undefined && (!Array.isArray(sensorIds) || !sensorIds.every((n: number) => Number.isInteger(n) && n > 0))) {
      return NextResponse.json({ error: 'sensorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (actuatorIds !== undefined && (!Array.isArray(actuatorIds) || !actuatorIds.every((n: number) => Number.isInteger(n) && n > 0))) {
      return NextResponse.json({ error: 'actuatorIds debe ser un arreglo de enteros positivos.' }, { status: 400 });
    }
    if (sensorIds !== undefined && actuatorIds !== undefined && sensorIds.length === 0 && actuatorIds.length === 0) {
      return NextResponse.json({ error: 'Debe tener al menos un sensor o actuador.' }, { status: 400 });
    }
    if (publico !== undefined && typeof publico !== 'boolean') {
      return NextResponse.json({ error: 'publico debe ser booleano.' }, { status: 400 });
    }

    // Reactivación (solo admin)
    if (activo !== undefined) {
      if (activo === true) {
        if (acting.role !== 'admin') {
          return NextResponse.json({ error: 'Solo admin puede reactivar proyectos' }, { status: 403 });
        }
      } else if (activo === false) {
        return NextResponse.json({ error: 'Para desactivar use DELETE /api/projects/:id' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 });
      }
    }

    // Verificar ownership de sensores/actuadores
    if (sensorIds?.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countSens = await prisma.sensor.count({
        where: { sensor_id: { in: sensorIds }, ...ownershipFilter },
      });
      if (countSens !== sensorIds.length) {
        return NextResponse.json({ error: 'Uno o más sensores no existen o no te pertenecen.' }, { status: 400 });
      }
    }
    if (actuatorIds?.length) {
      const ownershipFilter = getOwnershipFilter(acting.id, acting.role);
      const countActs = await prisma.actuador.count({
        where: { actuator_id: { in: actuatorIds }, ...ownershipFilter },
      });
      if (countActs !== actuatorIds.length) {
        return NextResponse.json({ error: 'Uno o más actuadores no existen o no te pertenecen.' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (activo !== undefined) updateData.activo = activo;
    if (publico !== undefined) updateData.publico = publico;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.proyecto.update({ where: { project_id: projectId }, data: updateData });
      }

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
        select: { project_id: true, nombre: true, publico: true },
      });
    });

    return NextResponse.json(
      { id: String(updated?.project_id), name: updated?.nombre, publico: updated?.publico, message: 'Proyecto actualizado' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para editar proyectos' }, { status });
    console.error('PATCH /api/projects/:id error:', err);
    return NextResponse.json({ error: 'No se pudo actualizar el proyecto' }, { status: 500 });
  }
}

// DELETE /api/projects/:id
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
    const acting = await requireCanMutate();

    const existing = await prisma.proyecto.findUnique({
      where: { project_id: projectId },
      select: { creadorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    if (!canModifyResource(existing.creadorId, acting)) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este proyecto' }, { status: 403 });
    }

    await prisma.proyecto.update({
      where: { project_id: projectId },
      data: { activo: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para eliminar proyectos' }, { status });
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }
    console.error('DELETE /api/projects/:id error:', err);
    return NextResponse.json({ error: 'No se pudo eliminar el proyecto' }, { status: 500 });
  }
}
