import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, requireAdmin } from '@/lib/auth';

// Lista de categorías válidas (fuente única de verdad)
const CATEGORIAS = [
  'temperatura',
  'presion',
  'volumen',
  'masa',
  'tiempo',
  'velocidad',
  'concentracion',
  'pH',
  'flujo',
  'frecuencia',
  'porcentaje',
  'otra',
] as const;

type CategoriaUnidad = typeof CATEGORIAS[number];

// Helpers sin `any`
function norm(s: string) {
  // quita tildes y normaliza casing; trata el caso especial de pH
  const base = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lower = base.toLowerCase();
  return lower === 'ph' ? 'pH' : lower;
}

function toCategoria(x: unknown): CategoriaUnidad | null {
  if (typeof x !== 'string') return null;
  const key = norm(x);
  const hit = CATEGORIAS.find((v) => norm(v) === key);
  return hit ?? null;
}

function pickString(obj: unknown, key: string): string {
  if (obj && typeof obj === 'object') {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'string') return val.trim();
  }
  return '';
}

function pickUnknown(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
}

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
      activo: true,
    },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });

  return NextResponse.json(rows);
}

// POST /api/units
export async function POST(req: Request) {
  try {
    await requireCanMutate();

    const raw = (await req.json()) as unknown;

    const nombre = pickString(raw, 'nombre');
    const simbolo = pickString(raw, 'simbolo');
    const categoriaRaw = pickUnknown(raw, 'categoria');

    if (!nombre)  return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
    if (!simbolo) return NextResponse.json({ error: 'Falta símbolo' }, { status: 400 });

    const categoria = toCategoria(categoriaRaw);
    if (!categoria) {
      return NextResponse.json(
        { error: 'Categoría inválida', valores: CATEGORIAS },
        { status: 400 }
      );
    }

    const created = await prisma.unidadMedida.create({
      data: {
        nombre,
        simbolo,
        categoria, // ✅ Tipo correcto: CategoriaUnidad (union de CATEGORIAS)
      },
      select: { id: true, nombre: true, simbolo: true, categoria: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para crear unidades' }, { status });

    return NextResponse.json({ error: 'Error creando unidad de medida' }, { status: 500 });
  }
}
