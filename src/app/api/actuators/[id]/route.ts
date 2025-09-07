import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseId(id: string) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const a = await prisma.actuador.findUnique({ where: { actuator_id: id } });
  if (!a) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json({
    nombre: a.nombre,
    descripcion: a.descripcion ?? '',
    unidadMedida: a.unidad_de_medida,
    valorMin: String(a.valor_min),
    valorMax: String(a.valor_max),
    fuenteDatos: a.fuente_datos ?? '',
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const body = await req.json();

  const nombre = (body?.nombre ?? '').trim();
  const unidadMedida = (body?.unidadMedida ?? '').trim();
  const descripcion = body?.descripcion?.trim() || undefined;
  const fuenteDatos = body?.fuenteDatos?.trim() || undefined;

  if (body?.valorMin === undefined || body?.valorMax === undefined)
    return NextResponse.json({ error: 'Faltan mínimos/máximos' }, { status: 400 });

  const valorMin = Number(body.valorMin);
  const valorMax = Number(body.valorMax);

  if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
  if (!unidadMedida) return NextResponse.json({ error: 'Falta unidad' }, { status: 400 });
  if (Number.isNaN(valorMin) || Number.isNaN(valorMax))
    return NextResponse.json({ error: 'Min/Max deben ser numéricos' }, { status: 400 });
  if (valorMin > valorMax)
    return NextResponse.json({ error: 'Máximo debe ser ≥ mínimo' }, { status: 400 });

  await prisma.actuador.update({
    where: { actuator_id: id },
    data: {
      nombre,
      descripcion,
      unidad_de_medida: unidadMedida,
      valor_min: valorMin,
      valor_max: valorMax,
      fuente_datos: fuenteDatos,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  await prisma.actuador.delete({ where: { actuator_id: id } });
  return new NextResponse(null, { status: 204 });
}
