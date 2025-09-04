// export const runtime = 'nodejs';

// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireAuth, isManagerOrAdmin } from '@/lib/auth';

// function getStatus(e: unknown, fallback = 500): number {
//   if (typeof e === 'object' && e !== null && 'status' in e) {
//     const s = (e as { status?: unknown }).status;
//     if (typeof s === 'number') return s;
//   }
//   return fallback;
// }

// /** GET /api/projects - Solo usuarios autenticados (>= operator) */
// export async function GET() {
//   try {
//     await requireAuth();
//     const items = await prisma.proyecto.findMany({ orderBy: { project_id: 'asc' } });
//     return NextResponse.json(items);
//   } catch (e: unknown) {
//     const status = getStatus(e, 500);
//     const message = status === 401 ? 'No autenticado' : 'Error al listar proyectos';
//     return NextResponse.json({ message }, { status });
//   }
// }

// /** POST /api/projects - Solo labManager/admin */
// export async function POST(req: Request) {
//   try {
//     const { role } = await requireAuth();
//     if (!isManagerOrAdmin(role)) {
//       return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
//     }

//     const body = await req.json();
//     const data = {
//       nombre: String(body?.nombre ?? '').trim(),
//       descripcion: body?.descripcion != null ? String(body.descripcion) : null,
//     };

//     if (!data.nombre) {
//       return NextResponse.json({ message: 'nombre es obligatorio' }, { status: 400 });
//     }

//     const created = await prisma.proyecto.create({ data });
//     return NextResponse.json(created, { status: 201 });
//   } catch (e: unknown) {
//     console.error('POST /api/projects', e);
//     return NextResponse.json({ message: 'Error al crear proyecto' }, { status: 500 });
//   }
// }
export {};
