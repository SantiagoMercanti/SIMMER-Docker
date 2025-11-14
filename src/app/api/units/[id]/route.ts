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

// GET /api/units/[id]/usage → verifica si está en uso
export async function usage(id: number) {
  const [sensoresCount, actuadoresCount] = await Promise.all([
    prisma.sensor.count({
      where: { unidad_medida_id: id, activo: true },
    }),
    prisma.actuador.count({
      where: { unidad_medida_id: id, activo: true },
    }),
  ]);

  const sensores = await prisma.sensor.findMany({
    where: { unidad_medida_id: id, activo: true },
    select: { sensor_id: true, nombre: true },
  });

  const actuadores = await prisma.actuador.findMany({
    where: { unidad_medida_id: id, activo: true },
    select: { actuator_id: true, nombre: true },
  });

  return {
    inUse: sensoresCount + actuadoresCount > 0,
    sensores,
    actuadores,
    total: sensoresCount + actuadoresCount,
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
      select: { id: true, activo: true },
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

    // Verificar uso (informativo, no bloquea)
    const usageInfo = await usage(id);

    // Soft-delete
    await prisma.unidadMedida.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json(
      {
        message: 'Unidad marcada como inactiva',
        usage: usageInfo,
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
