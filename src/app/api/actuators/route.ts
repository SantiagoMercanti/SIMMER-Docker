import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/actuators → [{id, name}]
export async function GET() {
  const rows = await prisma.actuador.findMany({
    select: { actuator_id: true, nombre: true },
    orderBy: { actuator_id: 'asc' },
  });

  const data = rows.map(r => ({ id: String(r.actuator_id), name: r.nombre }));
  return NextResponse.json(data);
}

// POST /api/actuators
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const nombre: string = (body?.nombre ?? '').trim();
    const unidadMedida: string = (body?.unidadMedida ?? '').trim();
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
    if (!unidadMedida) return NextResponse.json({ error: 'Falta unidad de medida' }, { status: 400 });
    if (Number.isNaN(valorMin)) return NextResponse.json({ error: 'valorMin debe ser numérico' }, { status: 400 });
    if (Number.isNaN(valorMax)) return NextResponse.json({ error: 'valorMax debe ser numérico' }, { status: 400 });
    if (valorMin > valorMax) return NextResponse.json({ error: 'valorMax debe ser ≥ valorMin' }, { status: 400 });

    const created = await prisma.actuador.create({
      data: {
        nombre,
        descripcion,
        unidad_de_medida: unidadMedida,
        valor_min: valorMin,
        valor_max: valorMax,
        fuente_datos: fuenteDatos,
      },
      select: { actuator_id: true, nombre: true },
    });

    return NextResponse.json({ id: String(created.actuator_id), name: created.nombre }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error creando actuador' }, { status: 500 });
  }
}

