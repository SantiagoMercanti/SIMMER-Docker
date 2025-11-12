import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, requireAdmin } from '@/lib/auth';

// GET /api/units → [{id, nombre, simbolo, categoria, activo}]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (includeInactive) {
    try {
      await requireAdmin();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 403;
      const msg = status === 401 ? 'No autenticado' : 'No autorizado';
      return NextResponse.json({ error: msg }, { status });
    }
  }

  const rows = await prisma.unidadMedida.findMany({
    where: includeInactive ? {} : { activo: true },
    select: { 
      id: true, 
      nombre: true, 
      simbolo: true, 
      categoria: true,
      activo: true 
    },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });

  return NextResponse.json(rows);
}

// POST /api/units
export async function POST(req: Request) {
  try {
    await requireCanMutate();

    const body = await req.json();

    const nombre: string = (body?.nombre ?? '').trim();
    const simbolo: string = (body?.simbolo ?? '').trim();
    const categoria: string = body?.categoria;

    if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
    if (!simbolo) return NextResponse.json({ error: 'Falta símbolo' }, { status: 400 });
    if (!categoria) return NextResponse.json({ error: 'Falta categoría' }, { status: 400 });

    // Validar que la categoría sea válida
    const categoriasValidas = [
      'temperatura', 'presion', 'volumen', 'masa', 'tiempo', 
      'velocidad', 'concentracion', 'pH', 'flujo', 'frecuencia', 
      'porcentaje', 'otra'
    ];
    
    if (!categoriasValidas.includes(categoria)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    const created = await prisma.unidadMedida.create({
      data: {
        nombre,
        simbolo,
        categoria,
      },
      select: { id: true, nombre: true, simbolo: true, categoria: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para crear unidades' }, { status });
    
    // Error de duplicado (símbolo único)
    if ((err as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una unidad con ese símbolo' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Error creando unidad de medida' }, { status: 500 });
  }
}
