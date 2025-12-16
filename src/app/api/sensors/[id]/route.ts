import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser, canAccessResource, canModifyResource } from '@/lib/auth';

function toIntId(id: string) {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/sensors/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intId = toIntId(id);
  if (intId === null) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const s = await prisma.sensor.findUnique({
      where: { sensor_id: intId },
      select: {
        sensor_id: true,
        nombre: true,
        descripcion: true,
        unidad_medida_id: true,
        unidadMedida: {
          select: {
            id: true,
            nombre: true,
            simbolo: true,
            categoria: true,
          }
        },
        valor_min: true,
        valor_max: true,
        estado: true,
        fuente_datos: true,
        createdAt: true,
        updatedAt: true,
        activo: true,
        creadorId: true,
        creador: {
          select: {
            email: true,
            nombre: true,
            apellido: true,
          }
        },
      },
    });

    if (!s) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Verificar ownership
    if (!canAccessResource(s.creadorId, user)) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Si está inactivo, solo admin puede verlo
    if (!s.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Devolver con la información de la unidad y creador
    return NextResponse.json({
      id: s.sensor_id,
      nombre: s.nombre,
      descripcion: s.descripcion ?? null,
      unidadMedidaId: s.unidad_medida_id,
      unidadMedida: s.unidadMedida,
      valorMin: s.valor_min ?? null,
      valorMax: s.valor_max ?? null,
      estado: Boolean(s.estado),
      fuenteDatos: s.fuente_datos ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      creador: s.creador ? {
        email: s.creador.email,
        nombreCompleto: `${s.creador.nombre} ${s.creador.apellido}`.trim(),
      } : null,
    });
  } catch (_err: unknown) {
    console.error('Error en GET /api/sensors/:id', _err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PATCH /api/sensors/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intId = toIntId(id);
  if (intId === null) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // Requiere permisos de mutación
    const acting = await requireCanMutate();

    // Verificar que el sensor existe y obtener su creador
    const existing = await prisma.sensor.findUnique({
      where: { sensor_id: intId },
      select: { creadorId: true, activo: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    // Verificar ownership para modificación
    if (!canModifyResource(existing.creadorId, acting)) {
      return NextResponse.json({ error: 'No tienes permisos para editar este sensor' }, { status: 403 });
    }

    const body = await req.json();

    // Campos opcionales (actualización parcial)
    const nombre: string | undefined = body?.nombre?.trim?.() || undefined;
    const unidadMedidaId: number | undefined = body?.unidadMedidaId;
    const descripcionRaw: unknown = body?.descripcion;
    const fuenteDatosRaw: unknown = body?.fuenteDatos;

    const descripcion =
      typeof descripcionRaw === 'string'
        ? (descripcionRaw.trim() || null)
        : undefined;
    const fuenteDatos =
      typeof fuenteDatosRaw === 'string'
        ? (fuenteDatosRaw.trim() || null)
        : undefined;

    let valorMin: number | undefined;
    let valorMax: number | undefined;

    if (body?.valorMin !== undefined && body?.valorMin !== '') {
      const n = Number(body.valorMin);
      if (Number.isNaN(n)) {
        return NextResponse.json({ error: 'valorMin debe ser numérico' }, { status: 400 });
      }
      valorMin = n;
    }

    if (body?.valorMax !== undefined && body?.valorMax !== '') {
      const n = Number(body.valorMax);
      if (Number.isNaN(n)) {
        return NextResponse.json({ error: 'valorMax debe ser numérico' }, { status: 400 });
      }
      valorMax = n;
    }

    if (valorMin !== undefined && valorMax !== undefined && valorMin > valorMax) {
      return NextResponse.json({ error: 'valorMax debe ser ≥ valorMin' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (unidadMedidaId !== undefined) data.unidad_medida_id = unidadMedidaId;
    if (valorMin !== undefined) data.valor_min = valorMin;
    if (valorMax !== undefined) data.valor_max = valorMax;
    if (fuenteDatos !== undefined) data.fuente_datos = fuenteDatos;

    // Reactivación (solo admin)
    if (body?.activo !== undefined) {
      if (body.activo === true) {
        if (acting.role !== 'admin') {
          return NextResponse.json({ error: 'Solo admin puede reactivar sensores' }, { status: 403 });
        }
        data.activo = true;
      } else if (body.activo === false) {
        return NextResponse.json({ error: 'Para desactivar use DELETE /api/sensors/:id' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'activo debe ser booleano' }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    const updated = await prisma.sensor.update({
      where: { sensor_id: intId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para editar sensores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Actualización fallida' }, { status: 400 });
  }
}

// DELETE /api/sensors/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intId = toIntId(id);
  if (intId === null) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    // ✅ Requiere permisos de mutación
    const acting = await requireCanMutate();

    // ✅ Verificar ownership
    const existing = await prisma.sensor.findUnique({
      where: { sensor_id: intId },
      select: { creadorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    if (!canModifyResource(existing.creadorId, acting)) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este sensor' }, { status: 403 });
    }

    await prisma.sensor.update({
      where: { sensor_id: intId },
      data: { activo: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para eliminar sensores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Eliminación fallida' }, { status: 400 });
  }
}
