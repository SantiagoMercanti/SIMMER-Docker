import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: intId },
    });
    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }
    return NextResponse.json(sensor);
  } catch (_err: unknown) {
    return NextResponse.json({ error: 'Error del servidor', err: _err }, { status: 500 });
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
    const data = (await req.json()) as Record<string, unknown>;
    const updated = await prisma.sensor.update({
      where: { sensor_id: intId },
      data,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
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
    await prisma.sensor.delete({
      where: { sensor_id: intId },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Eliminación fallida' }, { status: 400 });
  }
}
