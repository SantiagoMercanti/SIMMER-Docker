import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET /api/users?status=inactive | active (default=active)
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'active').toLowerCase();
    const onlyActive = status !== 'inactive';

    const rows = await prisma.userMetadata.findMany({
      where: { activo: onlyActive },
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
    console.error('GET /api/users error:', err);
    return NextResponse.json({ error: 'Error listando usuarios' }, { status });
  }
}
