import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actuadorId = Number(id);
  if (!Number.isInteger(actuadorId) || actuadorId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const rows = await prisma.proyectoActuador.findMany({
    where: { actuadorId },
    select: { proyecto: { select: { project_id: true, nombre: true } } },
  });

  const projects = rows
    .map(r => r.proyecto)
    .filter(Boolean)
    .map(p => ({ id: p!.project_id, nombre: p!.nombre }));

  return NextResponse.json({ projects });
}
