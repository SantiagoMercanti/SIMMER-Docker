// export const runtime = 'nodejs';

// import { NextResponse } from 'next/server';
// import { Prisma } from '@prisma/client';
// import { prisma } from '@/lib/prisma';
// import { requireAuth, isManagerOrAdmin } from '@/lib/auth';

// function toDecimal(val: unknown): Prisma.Decimal | undefined {
//   if (val === null || val === undefined || val === '') return undefined;
//   const num = typeof val === 'number' ? val : parseFloat(String(val));
//   if (Number.isNaN(num)) return undefined;
//   return new Prisma.Decimal(num);
// }

// function getStatus(e: unknown, fallback = 500): number {
//   if (typeof e === 'object' && e !== null && 'status' in e) {
//     const s = (e as { status?: unknown }).status;
//     if (typeof s === 'number') return s;
//   }
//   return fallback;
// }

// /** GET /api/actuators - Solo usuarios autenticados (>= operator) */
// export async function GET() {
//   try {
//     await requireAuth();
//     const items = await prisma.actuador.findMany({ orderBy: { actuator_id: 'asc' } });
//     return NextResponse.json(items);
//   } catch (e: unknown) {
//     const status = getStatus(e, 500);
//     const message = status === 401 ? 'No autenticado' : 'Error al listar actuadores';
//     return NextResponse.json({ message }, { status });
//   }
// }

// /** POST /api/actuators - Solo labManager/admin */
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
//       unidad_de_medida: String(body?.unidad_de_medida ?? '').trim(),
//       valor_max: toDecimal(body?.valor_max),
//       valor_min: toDecimal(body?.valor_min),
//       estado: body?.estado === undefined ? true : Boolean(body.estado),
//       fuente_datos: body?.fuente_datos != null ? String(body.fuente_datos) : null,
//     };

//     if (!data.nombre || !data.unidad_de_medida) {
//       return NextResponse.json(
//         { message: 'nombre y unidad_de_medida son obligatorios' },
//         { status: 400 }
//       );
//     }

//     const created = await prisma.actuador.create({ data });
//     return NextResponse.json(created, { status: 201 });
//   } catch (e: unknown) {
//     console.error('POST /api/actuators', e);
//     return NextResponse.json({ message: 'Error al crear actuador' }, { status: 500 });
//   }
// }
export {};
