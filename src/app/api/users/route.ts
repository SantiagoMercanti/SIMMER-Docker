import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET /api/users → lista de usuarios activos
export async function GET() {
  try {
    await requireAdmin();

    const rows = await prisma.userMetadata.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        tipo: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Devolvemos tal cual (id es UUID string)
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Acceso solo para administradores' }, { status });
    return NextResponse.json({ error: 'Error listando usuarios' }, { status });
  }
}
