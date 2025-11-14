import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET /api/units/[id] → detalle de una unidad
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const unidad = await prisma.unidadMedida.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      simbolo: true,
      categoria: true,
      activo: true,
    },
  });

  if (!unidad) {
    return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });
  }

  return NextResponse.json(unidad);
}

// Función auxiliar para verificar uso de una unidad
async function checkUnitUsage(id: number) {
  const [sensores, actuadores] = await Promise.all([
    prisma.sensor.findMany({
      where: { unidad_medida_id: id, activo: true },
      select: { sensor_id: true, nombre: true },
    }),
    prisma.actuador.findMany({
      where: { unidad_medida_id: id, activo: true },
      select: { actuator_id: true, nombre: true },
    }),
  ]);

  return {
    sensores,
    actuadores,
    inUse: sensores.length > 0 || actuadores.length > 0,
  };
}

// DELETE /api/units/[id] → soft-delete (solo admin)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Solo admin puede eliminar unidades
    await requireAdmin();

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar si existe
    const unidad = await prisma.unidadMedida.findUnique({
      where: { id },
      select: { id: true, activo: true, nombre: true },
    });

    if (!unidad) {
      return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });
    }

    if (!unidad.activo) {
      return NextResponse.json(
        { error: 'La unidad ya está inactiva' },
        { status: 400 }
      );
    }

    // Verificar si está en uso
    const usage = await checkUnitUsage(id);

    if (usage.inUse) {
      // BLOQUEAR eliminación si está en uso
      const elementos = [];
      
      if (usage.sensores.length > 0) {
        elementos.push(
          ...usage.sensores.map(s => `Sensor: ${s.nombre}`)
        );
      }
      
      if (usage.actuadores.length > 0) {
        elementos.push(
          ...usage.actuadores.map(a => `Actuador: ${a.nombre}`)
        );
      }

      return NextResponse.json(
        {
          error: 'No se puede eliminar la unidad de medida',
          message: `La unidad "${unidad.nombre}" está siendo utilizada en los siguientes elementos:`,
          elementos: elementos,
          sensores: usage.sensores.map(s => ({ id: s.sensor_id, nombre: s.nombre })),
          actuadores: usage.actuadores.map(a => ({ id: a.actuator_id, nombre: a.nombre })),
        },
        { status: 400 }
      );
    }

    // Si no está en uso, permitir soft-delete
    await prisma.unidadMedida.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json(
      {
        message: 'Unidad marcada como inactiva',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401)
      return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403)
      return NextResponse.json(
        { error: 'Solo administradores pueden eliminar unidades' },
        { status }
      );

    console.error('Error eliminando unidad:', err);
    return NextResponse.json(
      { error: 'Error eliminando unidad de medida' },
      { status: 500 }
    );
  }
}

// PATCH /api/units/[id] → reactivar o editar
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await req.json();

    // Solo permitir actualizar activo y nombre/descripción básica
    const updateData: { activo?: boolean; nombre?: string } = {};

    if (typeof body.activo === 'boolean') {
      updateData.activo = body.activo;
    }
    if (typeof body.nombre === 'string' && body.nombre.trim()) {
      updateData.nombre = body.nombre.trim();
    }

    const updated = await prisma.unidadMedida.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        simbolo: true,
        categoria: true,
        activo: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401)
      return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403)
      return NextResponse.json({ error: 'No autorizado' }, { status });

    console.error('Error actualizando unidad:', err);
    return NextResponse.json(
      { error: 'Error actualizando unidad' },
      { status: 500 }
    );
  }
}
