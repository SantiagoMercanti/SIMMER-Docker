import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, requireAdmin } from '@/lib/auth';

// GET /api/sensors → [{id, name, activo}]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (includeInactive) {
    try {
      await requireAdmin(); // ← solo admin puede ver inactivos
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 403;
      const msg = status === 401 ? 'No autenticado' : 'No autorizado';
      return NextResponse.json({ error: msg }, { status });
    }
  }

  const rows = await prisma.sensor.findMany({
    where: includeInactive ? {} : { activo: true },
    select: { sensor_id: true, nombre: true, activo: true },
    orderBy: [{ activo: 'desc' }, { sensor_id: 'asc' }],
  });

  const data = rows.map(r => ({
    id: String(r.sensor_id),
    name: r.nombre,
    activo: r.activo  // ← Agregado
  }));
  return NextResponse.json(data);
}

// POST /api/sensors
export async function POST(req: Request) {
  try {
    // Bloquea a 'operator' (y lanza 401 si no hay sesión)
    await requireCanMutate();

    const body = await req.json();

    const nombre: string = (body?.nombre ?? '').trim();
    const unidadMedidaId: number = body?.unidadMedidaId;  // ← CAMBIO
    const descripcion: string | undefined = body?.descripcion?.trim() || undefined;
    const fuenteDatos: string | undefined = body?.fuenteDatos?.trim() || undefined;

    if (body?.valorMin === undefined || body?.valorMin === '') {
      return NextResponse.json({ error: 'Falta valorMin' }, { status: 400 });
    }
    if (body?.valorMax === undefined || body?.valorMax === '') {
      return NextResponse.json({ error: 'Falta valorMax' }, { status: 400 });
    }

    const valorMin = Number(body.valorMin);
    const valorMax = Number(body.valorMax);

    if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
    if (!unidadMedidaId) return NextResponse.json({ error: 'Falta unidad de medida' }, { status: 400 });  // ← CAMBIO
    if (Number.isNaN(valorMin)) return NextResponse.json({ error: 'valorMin debe ser numérico' }, { status: 400 });
    if (Number.isNaN(valorMax)) return NextResponse.json({ error: 'valorMax debe ser numérico' }, { status: 400 });
    if (valorMin > valorMax) return NextResponse.json({ error: 'valorMax debe ser ≥ valorMin' }, { status: 400 });

    const created = await prisma.sensor.create({
      data: {
        nombre,
        descripcion,
        unidad_medida_id: unidadMedidaId,  // ← CAMBIO
        valor_min: valorMin,
        valor_max: valorMax,
        fuente_datos: fuenteDatos,
      },
      select: { sensor_id: true, nombre: true },
    });

    return NextResponse.json({ id: String(created.sensor_id), name: created.nombre }, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para crear sensores' }, { status });
    return NextResponse.json({ error: 'Error creando sensor' }, { status: 500 });
  }
}
