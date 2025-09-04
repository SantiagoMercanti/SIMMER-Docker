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

// function parseId(id: string | string[] | undefined): number | null {
//   if (!id || Array.isArray(id)) return null;
//   const n = Number(id);
//   return Number.isInteger(n) ? n : null;
// }

// function getStatus(e: unknown, fallback = 500): number {
//   if (typeof e === 'object' && e !== null && 'status' in e) {
//     const s = (e as { status?: unknown }).status;
//     if (typeof s === 'number') return s;
//   }
//   return fallback;
// }

// /** GET /api/actuators/:id - Solo usuarios autenticados (>= operator) */
// export async function GET(_: Request, { params }: { params: { id: string } }) {
//   try {
//     await requireAuth();
//     const id = parseId(params.id);
//     if (id == null) {
//       return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
//     }

//     const item = await prisma.actuador.findUnique({ where: { actuator_id: id } });
//     if (!item) {
//       return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
//     }

//     return NextResponse.json(item);
//   } catch (e: unknown) {
//     const status = getStatus(e, 500);
//     const message = status === 401 ? 'No autenticado' : 'Error al obtener actuador';
//     return NextResponse.json({ message }, { status });
//   }
// }

// /** PUT /api/actuators/:id - Solo labManager/admin */
// export async function PUT(req: Request, { params }: { params: { id: string } }) {
//   try {
//     const { role } = await requireAuth();
//     if (!isManagerOrAdmin(role)) {
//       return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
//     }

//     const id = parseId(params.id);
//     if (id == null) {
//       return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
//     }

//     const body = await req.json();
//     const data = {
//       nombre: body?.nombre !== undefined ? String(body.nombre).trim() : undefined,
//       descripcion: body?.descripcion !== undefined ? String(body.descripcion) : undefined,
//       unidad_de_medida:
//         body?.unidad_de_medida !== undefined ? String(body.unidad_de_medida).trim() : undefined,
//       valor_max: body?.valor_max !== undefined ? toDecimal(body.valor_max) : undefined,
//       valor_min: body?.valor_min !== undefined ? toDecimal(body.valor_min) : undefined,
//       estado: body?.estado !== undefined ? Boolean(body.estado) : undefined,
//       fuente_datos: body?.fuente_datos !== undefined ? String(body.fuente_datos) : undefined,
//     };

//     const updated = await prisma.actuador.update({
//       where: { actuator_id: id },
//       data,
//     });

//     return NextResponse.json(updated);
//   } catch (e: unknown) {
//     if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
//       return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
//     }
//     console.error('PUT /api/actuators/[id]', e);
//     const status = getStatus(e, 500);
//     const message = status === 401 ? 'No autenticado' : 'Error al actualizar actuador';
//     return NextResponse.json({ message }, { status });
//   }
// }

// /** DELETE /api/actuators/:id - Solo labManager/admin */
// export async function DELETE(_: Request, { params }: { params: { id: string } }) {
//   try {
//     const { role } = await requireAuth();
//     if (!isManagerOrAdmin(role)) {
//       return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
//     }

//     const id = parseId(params.id);
//     if (id == null) {
//       return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
//     }

//     await prisma.actuador.delete({ where: { actuator_id: id } });
//     return NextResponse.json({ message: 'Eliminado' });
//   } catch (e: unknown) {
//     if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
//       return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
//     }
//     console.error('DELETE /api/actuators/[id]', e);
//     const status = getStatus(e, 500);
//     const message = status === 401 ? 'No autenticado' : 'Error al eliminar actuador';
//     return NextResponse.json({ message }, { status });
//   }
// }
