import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCanMutate } from '@/lib/auth';

function toIntId(id: string) {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/actuators/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intId = Number(id);
  if (!Number.isInteger(intId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const a = await prisma.actuador.findUnique({
      where: { actuator_id: intId },
      select: {
        actuator_id: true,
        nombre: true,
        descripcion: true,
        unidad_de_medida: true,
        valor_min: true,
        valor_max: true,
        estado: true,
        fuente_datos: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!a) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // Devolvemos floats para rango; strings donde el form hace .trim()
    return NextResponse.json({
      id: a.actuator_id,
      nombre: a.nombre,
      descripcion: a.descripcion ?? null,
      unidadMedida: a.unidad_de_medida ?? '',
      valorMin: a.valor_min ?? null,
      valorMax: a.valor_max ?? null,
      estado: Boolean(a.estado),
      fuenteDatos: a.fuente_datos ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    });
  } catch (_err: unknown) {
    return NextResponse.json({ error: 'Error del servidor', err: _err }, { status: 500 });
  }
}

// PATCH /api/actuators/:id
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
    // Bloquea a 'operator' y lanza 401 si no hay sesión
    await requireCanMutate();

    const body = await req.json();

    // Campos opcionales (actualización parcial)
    const nombre: string | undefined = body?.nombre?.trim?.() || undefined;
    const unidadMedida: string | undefined = body?.unidadMedida?.trim?.() || undefined;
    const descripcionRaw: unknown = body?.descripcion;
    const fuenteDatosRaw: unknown = body?.fuenteDatos;

    // Normalizamos opcionales string -> string|null
    const descripcion =
      typeof descripcionRaw === 'string'
        ? (descripcionRaw.trim() || null)
        : undefined; // undefined = no tocar; null = setear a null
    const fuenteDatos =
      typeof fuenteDatosRaw === 'string'
        ? (fuenteDatosRaw.trim() || null)
        : undefined;

    // Numéricos opcionales: si vienen deben ser válidos
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

    // Si vinieron ambos, validamos relación
    if (valorMin !== undefined && valorMax !== undefined && valorMin > valorMax) {
      return NextResponse.json({ error: 'valorMax debe ser ≥ valorMin' }, { status: 400 });
    }

    // Construimos el objeto de actualización SOLO con lo presente
    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion; // string|null
    if (unidadMedida !== undefined) data.unidad_de_medida = unidadMedida;
    if (valorMin !== undefined) data.valor_min = valorMin;
    if (valorMax !== undefined) data.valor_max = valorMax;
    if (fuenteDatos !== undefined) data.fuente_datos = fuenteDatos; // string|null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    const updated = await prisma.actuador.update({
      where: { actuator_id: intId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para editar actuadores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Actualización fallida' }, { status: 400 });
  }
}

// DELETE /api/actuators/:id
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
    // Bloquea a 'operator' y lanza 401 si no hay sesión
    await requireCanMutate();

    await prisma.actuador.delete({
      where: { actuator_id: intId },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para eliminar actuadores' }, { status });

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Eliminación fallida' }, { status: 400 });
  }
}
